/**
 * STDIO模式应用程序
 * 专门处理STDIO模式的MCP代理服务
 */

import { StdioProxyServer } from "./core/StdioProxyServer";
import { MCPConnectionManager } from "./core/MCPConnectionManager";
import { configLoader } from "./utils/ConfigLoader";
import { logger } from "./utils/Logger";
import { Config } from "./types/ConfigTypes";

export class STDIOApplication {
    private stdioServer?: StdioProxyServer;
    private connectionManager: MCPConnectionManager;
    private config: Config;
    private currentSchema: string;
    private isRunning: boolean = false;

    constructor(config: Config, schemaName: string) {
        this.config = config;
        this.currentSchema = schemaName;
        this.connectionManager = new MCPConnectionManager();

        // 配置日志器
        if (config.logging) {
            logger.configure(config.logging);
        }

        logger.info(`STDIO Application initialized for schema: ${schemaName}`);
    }

    /**
     * 启动STDIO应用程序
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn("STDIO Application is already running");
            return;
        }

        try {
            logger.info("Starting STDIO mcps-proxy application...");

            // 初始化指定schema
            await this.initializeSingleSchema(this.currentSchema);

            // 创建并启动STDIO服务器
            this.stdioServer = new StdioProxyServer(this.connectionManager, this.config.cli?.stdio);
            this.stdioServer.setCurrentSchema(this.currentSchema);
            await this.stdioServer.start();

            this.isRunning = true;
            logger.info("STDIO Application started successfully");

        } catch (error) {
            logger.error("Failed to start STDIO application:", error);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * 停止STDIO应用程序
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn("STDIO Application is not running");
            return;
        }

        try {
            logger.info("Stopping STDIO application...");

            await this.cleanup();

            this.isRunning = false;
            logger.info("STDIO Application stopped successfully");

        } catch (error) {
            logger.error("Error stopping STDIO application:", error);
            throw error;
        }
    }

    /**
     * 重新加载配置（STDIO模式不支持配置重载）
     */
    public async reloadConfig(): Promise<void> {
        throw new Error("STDIO mode does not support configuration reloading. Please restart the application with new configuration.");
    }

    /**
     * 获取应用程序状态
     */
    public getStatus(): any {
        if (!this.isRunning) {
            return {
                status: "stopped",
                mode: "stdio",
                message: "STDIO Application is not running",
            };
        }

        const schemas = this.connectionManager.getAllSchemaStatus();
        const currentSchemaStatus = schemas[this.currentSchema];

        return {
            status: "running",
            mode: "stdio",
            currentSchema: this.currentSchema,
            schemas: {
                [this.currentSchema]: currentSchemaStatus
            },
            summary: this.calculateSingleSchemaSummary(currentSchemaStatus),
        };
    }

    /**
     * 检查应用程序是否正在运行
     */
    public isApplicationRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 获取当前schema名称
     */
    public getCurrentSchema(): string {
        return this.currentSchema;
    }

    /**
     * 初始化单个schema
     */
    private async initializeSingleSchema(schemaName: string): Promise<void> {
        logger.info(`Initializing schema '${schemaName}' for STDIO mode...`);

        // 检查schema是否存在
        if (!this.config.schemas[schemaName]) {
            const availableSchemas = Object.keys(this.config.schemas);
            throw new Error(
                `Schema '${schemaName}' not found. Available schemas: ${availableSchemas.join(", ")}`
            );
        }

        const schemaConfig = this.config.schemas[schemaName];

        // 检查schema是否启用
        if (schemaConfig.enabled === false) {
            throw new Error(`Schema '${schemaName}' is disabled in configuration`);
        }

        try {
            await this.connectionManager.addSchema(schemaName, schemaConfig);
            logger.info(`Schema '${schemaName}' initialized successfully`);
        } catch (error) {
            logger.error(`Failed to initialize schema '${schemaName}':`, error);
            throw new Error(`Failed to initialize schema '${schemaName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        const cleanupTasks: Promise<void>[] = [];

        // 停止STDIO服务器
        if (this.stdioServer) {
            cleanupTasks.push(this.stdioServer.stop());
        }

        // 断开所有MCP连接
        cleanupTasks.push(this.connectionManager.disconnectAll());

        // 等待所有清理任务完成
        await Promise.all(cleanupTasks);
    }

    /**
     * 计算单个schema的汇总信息
     */
    private calculateSingleSchemaSummary(schemaStatus: any): any {
        if (!schemaStatus) {
            return {
                totalSchemas: 0,
                activeSchemas: 0,
                totalServers: 0,
                connectedServers: 0,
                failedServers: 0,
                totalTools: 0,
            };
        }

        const totalServers = schemaStatus.mcpServers.length;
        const connectedServers = schemaStatus.connectedServers || 0;
        const failedServers = schemaStatus.mcpServers.filter((s: any) => s.status === "error").length;
        const totalTools = schemaStatus.totalTools || 0;

        return {
            totalSchemas: 1,
            activeSchemas: schemaStatus.status === "active" ? 1 : 0,
            totalServers,
            connectedServers,
            failedServers,
            totalTools,
        };
    }
}
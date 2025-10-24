/**
 * 主应用程序
 * 整合所有组件，提供完整的MCP代理服务
 */

import { HTTPServer } from "./core/HTTPServer";
import { StdioProxyServer } from "./core/StdioProxyServer";
import { MCPConnectionManager } from "./core/MCPConnectionManager";
import { configLoader } from "./utils/ConfigLoader";
import { logger } from "./utils/Logger";
import { Config } from "./types/ConfigTypes";

export class Application {
    private server?: HTTPServer | StdioProxyServer;
    private connectionManager: MCPConnectionManager;
    private config: Config;
    private mode: "http" | "stdio";
    private isRunning: boolean = false;

    constructor(config: Config, mode: "http" | "stdio") {
        this.config = config;
        this.mode = mode;
        this.connectionManager = new MCPConnectionManager();

        // 配置日志器
        if (config.logging) {
            logger.configure(config.logging);
        }

        logger.info(`Application initialized in ${mode} mode`);
    }

    /**
     * 启动应用程序
     */
    public async start(schemaName?: string): Promise<void> {
        if (this.isRunning) {
            logger.warn("Application is already running");
            return;
        }

        try {
            logger.info(`Starting mcps-proxy application in ${this.mode} mode...`);

            // 根据模式初始化schemas
            if (this.mode === "stdio") {
                await this.initializeSingleSchema(schemaName || "default");
            } else {
                await this.initializeAllSchemas();
            }

            // 根据模式创建并启动服务器
            if (this.mode === "stdio") {
                this.server = new StdioProxyServer(this.connectionManager, this.config.cli?.stdio);
                logger.info("Created STDIO proxy server");
            } else {
                this.server = new HTTPServer(this.connectionManager, this.config.server);
                logger.info("Created HTTP server");
            }

            await this.server.start();

            this.isRunning = true;
            logger.info("Application started successfully");

        } catch (error) {
            logger.error("Failed to start application:", error);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * 停止应用程序
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn("Application is not running");
            return;
        }

        try {
            logger.info("Stopping application...");

            await this.cleanup();

            this.isRunning = false;
            logger.info("Application stopped successfully");

        } catch (error) {
            logger.error("Error stopping application:", error);
            throw error;
        }
    }

    /**
     * 重新加载配置
     */
    public async reloadConfig(): Promise<void> {
        try {
            logger.info("Reloading configuration...");

            // 停止当前连接
            await this.connectionManager.disconnectAll();

            // 重新加载配置
            this.config = configLoader.loadConfig();

            // 重新配置日志器
            if (this.config.logging) {
                logger.configure(this.config.logging);
            }

            // 重新初始化schemas（仅HTTP模式支持配置重载）
            if (this.mode === "http") {
                await this.initializeAllSchemas();
            }

            logger.info("Configuration reloaded successfully");

        } catch (error) {
            logger.error("Failed to reload configuration:", error);
            throw error;
        }
    }

    /**
     * 获取应用程序状态
     */
    public getStatus(): any {
        if (!this.isRunning) {
            return {
                status: "stopped",
                message: "Application is not running",
            };
        }

        const schemas = this.connectionManager.getAllSchemaStatus();
        const summary = this.calculateSummary(schemas);

        return {
            status: "running",
            server: {
                port: this.config.server.port,
                host: this.config.server.host || "127.0.0.1",
                uptime: process.uptime(),
            },
            schemas,
            summary,
        };
    }

    /**
     * 检查应用程序是否正在运行
     */
    public isApplicationRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 初始化所有schemas（HTTP模式）
     */
    private async initializeAllSchemas(): Promise<void> {
        const schemaNames = Object.keys(this.config.schemas);
        logger.info(`Initializing ${schemaNames.length} schemas for HTTP mode...`);

        for (const [schemaName, schemaConfig] of Object.entries(this.config.schemas)) {
            try {
                await this.connectionManager.addSchema(schemaName, schemaConfig);
            } catch (error) {
                logger.error(`Failed to initialize schema '${schemaName}':`, error);
                // 继续初始化其他schemas，不阻止整个应用启动
            }
        }

        logger.info("All schemas initialization completed");
    }

    /**
     * 初始化单个schema（STDIO模式）
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

        // 停止服务器（HTTP或STDIO）
        if (this.server) {
            cleanupTasks.push(this.server.stop());
        }

        // 断开所有MCP连接
        cleanupTasks.push(this.connectionManager.disconnectAll());

        // 等待所有清理任务完成
        await Promise.all(cleanupTasks);
    }

    /**
     * 计算汇总信息
     */
    private calculateSummary(schemas: Record<string, any>): any {
        const schemaNames = Object.keys(schemas);
        const activeSchemas = schemaNames.filter(name => schemas[name].status === "active");

        let totalServers = 0;
        let connectedServers = 0;
        let failedServers = 0;
        let totalTools = 0;

        for (const schema of activeSchemas) {
            const schemaData = schemas[schema];
            totalServers += schemaData.mcpServers.length;
            connectedServers += schemaData.connectedServers;
            failedServers += schemaData.mcpServers.filter((s: any) => s.status === "error").length;
            totalTools += schemaData.totalTools;
        }

        return {
            totalSchemas: schemaNames.length,
            activeSchemas: activeSchemas.length,
            totalServers,
            connectedServers,
            failedServers,
            totalTools,
        };
    }
}
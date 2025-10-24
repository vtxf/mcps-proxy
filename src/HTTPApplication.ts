/**
 * HTTP模式应用程序
 * 专门处理HTTP模式的MCP代理服务
 */

import { HTTPServer } from "./core/HTTPServer";
import { MCPConnectionManager } from "./core/MCPConnectionManager";
import { configLoader } from "./utils/ConfigLoader";
import { logger } from "./utils/Logger";
import { Config } from "./types/ConfigTypes";

export class HTTPApplication {
    private httpServer?: HTTPServer;
    private connectionManager: MCPConnectionManager;
    private config: Config;
    private isRunning: boolean = false;

    constructor(config: Config) {
        this.config = config;
        this.connectionManager = new MCPConnectionManager();

        // 配置日志器
        if (config.logging) {
            logger.configure(config.logging);
        }

        logger.info("HTTP Application initialized");
    }

    /**
     * 启动HTTP应用程序
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn("HTTP Application is already running");
            return;
        }

        try {
            logger.info("Starting HTTP mcps-proxy application...");

            // 初始化所有schemas
            await this.initializeAllSchemas();

            // 创建并启动HTTP服务器
            this.httpServer = new HTTPServer(this.connectionManager, this.config.server);
            await this.httpServer.start();

            this.isRunning = true;
            logger.info("HTTP Application started successfully");

        } catch (error) {
            logger.error("Failed to start HTTP application:", error);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * 停止HTTP应用程序
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn("HTTP Application is not running");
            return;
        }

        try {
            logger.info("Stopping HTTP application...");

            await this.cleanup();

            this.isRunning = false;
            logger.info("HTTP Application stopped successfully");

        } catch (error) {
            logger.error("Error stopping HTTP application:", error);
            throw error;
        }
    }

    /**
     * 重新加载配置
     */
    public async reloadConfig(): Promise<void> {
        try {
            logger.info("Reloading HTTP configuration...");

            // 停止当前连接
            await this.connectionManager.disconnectAll();

            // 重新加载配置
            this.config = configLoader.loadConfig();

            // 重新配置日志器
            if (this.config.logging) {
                logger.configure(this.config.logging);
            }

            // 重新初始化schemas
            await this.initializeAllSchemas();

            logger.info("HTTP Configuration reloaded successfully");

        } catch (error) {
            logger.error("Failed to reload HTTP configuration:", error);
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
                mode: "http",
                message: "HTTP Application is not running",
            };
        }

        const schemas = this.connectionManager.getAllSchemaStatus();
        const summary = this.calculateSummary(schemas);

        return {
            status: "running",
            mode: "http",
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
     * 初始化所有schemas
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
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        const cleanupTasks: Promise<void>[] = [];

        // 停止HTTP服务器
        if (this.httpServer) {
            cleanupTasks.push(this.httpServer.stop());
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
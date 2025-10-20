#!/usr/bin/env node

/**
 * 命令行接口
 * 提供mcps-proxy的命令行工具
 */

import { configLoader } from "./utils/ConfigLoader";
import { Application } from "./app";
import { logger } from "./utils/Logger";

interface CLIOptions {
    port?: number;
    config?: string;
    version?: boolean;
    help?: boolean;
}

class CLI {
    private application?: Application;

    /**
     * 解析命令行参数
     */
    private parseArguments(): CLIOptions {
        const args = process.argv.slice(2);
        const options: CLIOptions = {};

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            switch (arg) {
                case "--port":
                    i++;
                    const port = parseInt(args[i]);
                    if (!isNaN(port) && port > 0 && port < 65536) {
                        options.port = port;
                    } else {
                        console.error("Error: Invalid port number");
                        process.exit(1);
                    }
                    break;

                case "--config":
                    i++;
                    options.config = args[i];
                    break;

                case "--version":
                    options.version = true;
                    break;

                case "--help":
                    options.help = true;
                    break;

                default:
                    if (arg.startsWith("-")) {
                        console.error(`Error: Unknown option ${arg}`);
                        this.showHelp();
                        process.exit(1);
                    }
                    break;
            }
        }

        return options;
    }

    /**
     * 显示帮助信息
     */
    private showHelp(): void {
        console.log(`
Usage: mcps-proxy [options]

Options:
  --port <port>     指定服务端口 (默认: 3095)
  --config <path>   指定配置文件路径
  --version         显示版本信息
  --help            显示帮助信息

Examples:
  mcps-proxy                                    # 使用默认配置启动
  mcps-proxy --port 8080                       # 指定端口启动
  mcps-proxy --config ./custom-config.json    # 使用自定义配置
  mcps-proxy --port 3000 --config ./dev.json   # 自定义端口和配置

Environment:
  NODE_ENV                                    # 设置运行环境 (development/production)

Configuration:
  默认配置文件位置: ~/.mcps-proxy/config.json
  首次运行会自动创建默认配置文件

API Endpoints:
  健康检查:   GET /health
  状态查询:   GET /api/status
  MCP协议:    POST /api/{schema}/mcp

For more information, visit: https://github.com/vtxf/mcps-proxy
        `);
    }

    /**
     * 显示版本信息
     */
    private showVersion(): void {
        const packageJson = require("../package.json");
        console.log(`mcps-proxy v${packageJson.version}`);
        console.log(`Node.js ${process.version}`);
        console.log(`Platform: ${process.platform} ${process.arch}`);
    }

    /**
     * 优雅地关闭应用
     */
    private async gracefulShutdown(): Promise<void> {
        console.log("\n正在关闭 mcps-proxy...");

        try {
            if (this.application) {
                await this.application.stop();
            }
            console.log("mcps-proxy 已安全关闭");
            process.exit(0);
        } catch (error) {
            console.error("关闭过程中发生错误:", error);
            process.exit(1);
        }
    }

    /**
     * 设置信号处理器
     */
    private setupSignalHandlers(): void {
        // 处理 Ctrl+C (SIGINT)
        process.on("SIGINT", () => {
            this.gracefulShutdown();
        });

        // 处理 SIGTERM (通常由系统发送)
        process.on("SIGTERM", () => {
            this.gracefulShutdown();
        });

        // 处理未捕获的异常
        process.on("uncaughtException", (error) => {
            console.error("Uncaught Exception:", error);
            this.gracefulShutdown();
        });

        // 处理未处理的 Promise 拒绝
        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            this.gracefulShutdown();
        });
    }

    /**
     * 启动应用程序
     */
    private async startApplication(options: CLIOptions): Promise<void> {
        try {
            // 加载配置
            const config = configLoader.loadConfig({
                configPath: options.config,
            });

            // 如果命令行指定了端口，覆盖配置文件中的设置
            if (options.port) {
                config.server.port = options.port;
            }

            // 设置环境变量
            if (process.env.NODE_ENV) {
                logger.info(`Environment: ${process.env.NODE_ENV}`);
            }

            // 创建并启动应用
            this.application = new Application(config);
            await this.application.start();

            // 显示启动信息
            console.log(`\n🚀 mcps-proxy 启动成功!`);
            console.log(`📍 服务地址: http://localhost:${config.server.port}`);
            console.log(`🔗 API端点: http://localhost:${config.server.port}/api/{schema}/mcp`);
            console.log(`📊 状态查询: http://localhost:${config.server.port}/api/status`);
            console.log(`🛑 按 Ctrl+C 停止服务\n`);

        } catch (error) {
            console.error("启动失败:", error);
            process.exit(1);
        }
    }

    /**
     * 运行CLI
     */
    public async run(): Promise<void> {
        try {
            const options = this.parseArguments();

            // 处理 --help 参数
            if (options.help) {
                this.showHelp();
                return;
            }

            // 处理 --version 参数
            if (options.version) {
                this.showVersion();
                return;
            }

            // 设置信号处理器
            this.setupSignalHandlers();

            // 启动应用程序
            await this.startApplication(options);

        } catch (error) {
            console.error("CLI 错误:", error);
            process.exit(1);
        }
    }
}

// 如果直接运行此文件，启动CLI
if (require.main === module) {
    const cli = new CLI();
    cli.run().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}

export { CLI };
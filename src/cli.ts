#!/usr/bin/env node

/**
 * 命令行接口
 * 提供mcps-proxy的命令行工具
 */

import { configLoader } from "./utils/ConfigLoader";
import { HTTPApplication } from "./HTTPApplication";
import { STDIOApplication } from "./STDIOApplication";
import { logger } from "./utils/Logger";

interface CLIOptions {
    port?: number;
    config?: string;
    version?: boolean;
    help?: boolean;

    // 新增参数
    mode?: "http" | "stdio";
    schema?: string;
}

class CLI {
    private httpApplication?: HTTPApplication;
    private stdioApplication?: STDIOApplication;

    /**
     * 解析模式相关参数
     */
    private parseModeArguments(options: CLIOptions): { mode: "http" | "stdio"; schema?: string } {
        return {
            mode: options.mode!,
            schema: options.schema
        };
    }

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

                case "--http":
                    if (options.mode) {
                        console.error("Error: Cannot specify both --http and --stdio modes");
                        process.exit(1);
                    }
                    options.mode = "http";
                    break;

                case "--stdio":
                    if (options.mode) {
                        console.error("Error: Cannot specify both --http and --stdio modes");
                        process.exit(1);
                    }
                    options.mode = "stdio";
                    break;

                case "--schema":
                    i++;
                    if (!args[i]) {
                        console.error("Error: --schema requires a schema name");
                        process.exit(1);
                    }
                    options.schema = args[i];
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

        // 验证参数组合
        if (options.schema && options.mode !== "stdio") {
            console.error("Error: --schema can only be used with --stdio mode");
            process.exit(1);
        }

        // 如果没有指定模式，默认为HTTP模式
        if (!options.mode) {
            options.mode = "http";
        }

        return options;
    }

    /**
     * 显示帮助信息
     */
    private showHelp(): void {
        console.log(`
⚠️  项目已废弃
本项目已废弃，不再维护。请迁移到新项目：
📦 mcp-all-in-one: https://www.npmjs.com/package/mcp-all-in-one
🔗 GitHub仓库: https://github.com/vtxf/mcp-all-in-one

Usage: mcps-proxy [options]

Options:
  --port <port>     指定服务端口 (默认: 3095)
  --config <path>   指定配置文件路径
  --http            以HTTP模式运行 (默认)
  --stdio           以STDIO模式运行
  --schema <name>   指定STDIO模式使用的schema名称 (默认: default)
  --version         显示版本信息
  --help            显示帮助信息

Examples:
  HTTP模式 (默认):
    mcps-proxy                                    # 使用默认配置启动HTTP模式
    mcps-proxy --http                             # 明确指定HTTP模式
    mcps-proxy --port 8080                        # 指定端口启动HTTP模式
    mcps-proxy --config ./custom-config.json     # 使用自定义配置

  STDIO模式:
    mcps-proxy --stdio                            # 启动STDIO模式，使用default schema
    mcps-proxy --stdio --schema=workspace         # 启动STDIO模式，使用指定schema
    mcps-proxy --stdio --schema=tools             # 启动STDIO模式，使用tools schema

Environment:
  NODE_ENV                                    # 设置运行环境 (development/production)

Configuration:
  默认配置文件位置: ~/.mcps-proxy/config.json
  首次运行会自动创建默认配置文件

API Endpoints:
  HTTP模式:
    健康检查:   GET /health
    状态查询:   GET /api/status
    MCP协议:    POST /api/{schema}/mcp

  STDIO模式:
    JSON-RPC协议通过stdin/stdout通信

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
        
        // 显示废弃提示
        console.log("\n⚠️  项目已废弃");
        console.log("本项目已废弃，不再维护。请迁移到新项目：");
        console.log("📦 mcp-all-in-one: https://www.npmjs.com/package/mcp-all-in-one");
        console.log("🔗 GitHub仓库: https://github.com/vtxf/mcp-all-in-one");
    }

    /**
     * 优雅地关闭应用
     */
    private async gracefulShutdown(): Promise<void> {
        console.log("正在关闭 mcps-proxy...");

        try {
            const shutdownPromises: Promise<void>[] = [];

            if (this.httpApplication) {
                shutdownPromises.push(this.httpApplication.stop());
            }
            if (this.stdioApplication) {
                shutdownPromises.push(this.stdioApplication.stop());
            }

            await Promise.all(shutdownPromises);
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
            console.log("\n收到中断信号，正在安全关闭...");
            this.gracefulShutdown();
        });

        // 处理 SIGTERM (通常由系统发送)
        process.on("SIGTERM", () => {
            console.log("\n收到终止信号，正在安全关闭...");
            this.gracefulShutdown();
        });

        // 处理未捕获的异常
        process.on("uncaughtException", (error) => {
            console.error("未捕获的异常:", error);
            console.log("正在安全关闭...");
            this.gracefulShutdown();
        });

        // 处理未处理的 Promise 拒绝
        process.on("unhandledRejection", (reason, promise) => {
            console.error("未处理的Promise拒绝:", promise, "reason:", reason);
            console.log("正在安全关闭...");
            this.gracefulShutdown();
        });
    }

    /**
     * 启动HTTP模式应用
     */
    private async startHTTPMode(options: CLIOptions): Promise<void> {
        try {
            // 显示废弃提示
            console.log("\n⚠️  项目已废弃");
            console.log("本项目已废弃，不再维护。请迁移到新项目：");
            console.log("📦 mcp-all-in-one: https://www.npmjs.com/package/mcp-all-in-one");
            console.log("🔗 GitHub仓库: https://github.com/vtxf/mcp-all-in-one\n");

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

            // 创建并启动HTTP应用
            this.httpApplication = new HTTPApplication(config);
            await this.httpApplication.start();

            // 显示启动信息
            console.log(`\n🚀 mcps-proxy HTTP模式启动成功!`);
            console.log(`📍 服务地址: http://localhost:${config.server.port}`);
            console.log(`🔗 API端点: http://localhost:${config.server.port}/api/{schema}/mcp`);
            console.log(`📊 状态查询: http://localhost:${config.server.port}/api/status`);
            console.log(`🛑 按 Ctrl+C 停止服务\n`);

        } catch (error) {
            console.error("HTTP模式启动失败:", error);
            process.exit(1);
        }
    }

    /**
     * 启动STDIO模式应用
     */
    private async startSTDIOMode(options: CLIOptions): Promise<void> {
        try {
            // 显示废弃提示
            console.log("\n⚠️  项目已废弃");
            console.log("本项目已废弃，不再维护。请迁移到新项目：");
            console.log("📦 mcp-all-in-one: https://www.npmjs.com/package/mcp-all-in-one");
            console.log("🔗 GitHub仓库: https://github.com/vtxf/mcp-all-in-one\n");

            // 加载配置
            const config = configLoader.loadConfig({
                configPath: options.config,
            });

            // 设置环境变量
            if (process.env.NODE_ENV) {
                logger.info(`Environment: ${process.env.NODE_ENV}`);
            }

            // 创建并启动STDIO应用
            const schemaName = options.schema || "default";
            this.stdioApplication = new STDIOApplication(config, schemaName);
            await this.stdioApplication.start();

            // 显示启动信息
            console.log(`\n🚀 mcps-proxy STDIO模式启动成功!`);
            console.log(`📋 Schema: ${schemaName}`);
            console.log(`🔗 JSON-RPC协议通过stdin/stdout通信`);
            console.log(`🛑 按 Ctrl+C 停止服务\n`);

        } catch (error) {
            console.error("STDIO模式启动失败:", error);
            process.exit(1);
        }
    }

    /**
     * 启动应用程序
     */
    private async startApplication(options: CLIOptions): Promise<void> {
        try {
            const { mode } = this.parseModeArguments(options);

            if (mode === "stdio") {
                await this.startSTDIOMode(options);
            } else {
                await this.startHTTPMode(options);
            }

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
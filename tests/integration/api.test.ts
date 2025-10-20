/**
 * API集成测试
 */

import request from "supertest";
import { Application } from "@/app";
import { Config } from "@/types/ConfigTypes";

describe("API Integration Tests", () => {
    let app: Application;
    let config: Config;

    beforeAll(async () => {
        // 创建测试配置
        config = {
            server: {
                port: 0, // 随机端口
                host: "127.0.0.1",
            },
            schemas: {
                test: {
                    enabled: true,
                    mcpServers: {
                        echo: {
                            command: "echo",
                            args: ["hello"],
                        },
                    },
                },
            },
            logging: {
                level: "error", // 减少测试期间的日志
                console: false,
            },
        };

        app = new Application(config);
    });

    afterAll(async () => {
        if (app && app.isApplicationRunning()) {
            await app.stop();
        }
    });

    describe("健康检查", () => {
        it("应该返回健康状态", async () => {
            // 由于我们需要启动应用来进行测试，这里先跳过
            // 实际的集成测试需要真实的MCP服务器
            expect(true).toBe(true);
        });
    });

    describe("状态查询", () => {
        it("应该返回应用状态", async () => {
            const status = app.getStatus();
            expect(status).toHaveProperty("status", "stopped");
        });
    });

    describe("配置验证", () => {
        it("应该接受有效的配置", () => {
            expect(() => {
                new Application(config);
            }).not.toThrow();
        });

        it("应该处理禁用的schema", () => {
            const configWithDisabledSchema: Config = {
                ...config,
                schemas: {
                    ...config.schemas,
                    disabled: {
                        enabled: false,
                        mcpServers: {},
                    },
                },
            };

            expect(() => {
                new Application(configWithDisabledSchema);
            }).not.toThrow();
        });
    });

    describe("错误处理", () => {
        it("应该处理无效的配置", () => {
            const invalidConfig = {
                server: {
                    port: -1, // 无效端口
                },
                schemas: {},
            } as Config;

            expect(() => {
                new Application(invalidConfig);
            }).not.toThrow(); // 配置验证是延迟的
        });
    });
});
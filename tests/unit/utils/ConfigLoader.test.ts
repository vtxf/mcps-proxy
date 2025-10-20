/**
 * ConfigLoader工具测试
 */

import { ConfigLoader, configLoader } from "@/utils/ConfigLoader";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

describe("ConfigLoader", () => {
    let testConfigLoader: ConfigLoader;
    const testConfigPath = join(__dirname, "test-config.json");

    beforeEach(() => {
        testConfigLoader = ConfigLoader.getInstance();
        testConfigLoader.clearCache();

        // 确保测试目录存在
        const testDir = dirname(testConfigPath);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }

        // 清理之前的测试文件
        if (existsSync(testConfigPath)) {
            unlinkSync(testConfigPath);
        }
    });

    afterEach(() => {
        // 清理测试文件
        if (existsSync(testConfigPath)) {
            unlinkSync(testConfigPath);
        }
        testConfigLoader.clearCache();
    });

    describe("单例模式", () => {
        it("应该返回相同的实例", () => {
            const instance1 = ConfigLoader.getInstance();
            const instance2 = ConfigLoader.getInstance();
            expect(instance1).toBe(instance2);
        });

        it("导出的configLoader实例应该是单例", () => {
            expect(configLoader).toBeInstanceOf(ConfigLoader);
        });
    });

    describe("配置加载", () => {
        it("应该能够加载有效的配置文件", () => {
            const validConfig = {
                server: {
                    port: 3000,
                    host: "localhost",
                },
                schemas: {
                    test: {
                        enabled: true,
                        mcpServers: {
                            testServer: {
                                command: "echo",
                                args: ["hello"],
                            },
                        },
                    },
                },
            };

            writeFileSync(testConfigPath, JSON.stringify(validConfig, null, 2));

            const config = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            expect(config.server.port).toBe(3000);
            expect(config.server.host).toBe("localhost");
            expect(config.schemas.test.enabled).toBe(true);
        });

        it("如果配置文件不存在应该创建默认配置", () => {
            const config = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            expect(config.server.port).toBe(3095);
            expect(config.schemas.default).toBeDefined();
            expect(existsSync(testConfigPath)).toBe(true);
        });

        it("应该拒绝无效的JSON", () => {
            writeFileSync(testConfigPath, "invalid json");

            expect(() => {
                testConfigLoader.loadConfig({
                    configPath: testConfigPath,
                });
            }).toThrow("Invalid JSON in config file");
        });

        it("应该验证必需字段", () => {
            const invalidConfig = {
                // 缺少必需的server和schemas字段
            };

            writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

            expect(() => {
                testConfigLoader.loadConfig({
                    configPath: testConfigPath,
                });
            }).toThrow("Server configuration is required");
        });

        it("应该验证端口号", () => {
            const invalidConfig = {
                server: {
                    port: 99999, // 无效端口号
                },
                schemas: {
                    test: {
                        enabled: true,
                        mcpServers: {},
                    },
                },
            };

            writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

            expect(() => {
                testConfigLoader.loadConfig({
                    configPath: testConfigPath,
                });
            }).toThrow("Port must be between 1 and 65535");
        });
    });

    describe("环境变量替换", () => {
        beforeEach(() => {
            // 设置测试环境变量
            process.env.TEST_API_KEY = "test-key-123";
            process.env.TEST_PORT = "8080";
        });

        afterEach(() => {
            // 清理测试环境变量
            delete process.env.TEST_API_KEY;
            delete process.env.TEST_PORT;
        });

        it("应该替换环境变量", () => {
            const configWithEnv = {
                server: {
                    port: 3000,
                    host: "localhost",
                },
                schemas: {
                    test: {
                        enabled: true,
                        mcpServers: {
                            testServer: {
                                command: "echo",
                                env: {
                                    API_KEY: "${TEST_API_KEY}",
                                },
                            },
                        },
                    },
                },
            };

            writeFileSync(testConfigPath, JSON.stringify(configWithEnv, null, 2));

            const config = testConfigLoader.loadConfig({
                configPath: testConfigPath,
                replaceEnvVars: true,
            });

            expect(config.schemas.test.mcpServers.testServer.env?.API_KEY).toBe("test-key-123");
        });

        it("应该处理未定义的环境变量", () => {
            const configWithUndefinedEnv = {
                server: {
                    port: 3000,
                    host: "localhost",
                },
                schemas: {
                    test: {
                        enabled: true,
                        mcpServers: {
                            testServer: {
                                command: "echo",
                                env: {
                                    UNDEFINED_VAR: "${UNDEFINED_VAR}",
                                },
                            },
                        },
                    },
                },
            };

            writeFileSync(testConfigPath, JSON.stringify(configWithUndefinedEnv, null, 2));

            const config = testConfigLoader.loadConfig({
                configPath: testConfigPath,
                replaceEnvVars: true,
            });

            // 未定义的环境变量应该保持原样
            expect(config.schemas.test.mcpServers.testServer.env?.UNDEFINED_VAR).toBe("${UNDEFINED_VAR}");
        });
    });

    describe("配置保存", () => {
        it("应该能够保存配置文件", () => {
            const config = {
                server: {
                    port: 4000,
                    host: "127.0.0.1",
                },
                schemas: {
                    test: {
                        enabled: true,
                        mcpServers: {},
                    },
                },
            };

            testConfigLoader.saveConfig(config, testConfigPath);

            expect(existsSync(testConfigPath)).toBe(true);

            // 验证保存的配置
            const loadedConfig = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            expect(loadedConfig.server.port).toBe(4000);
            expect(loadedConfig.server.host).toBe("127.0.0.1");
        });
    });

    describe("缓存管理", () => {
        it("应该缓存配置文件", () => {
            const config = {
                server: { port: 3000 },
                schemas: { test: { enabled: true, mcpServers: {} } },
            };

            writeFileSync(testConfigPath, JSON.stringify(config));

            // 第一次加载
            const config1 = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            // 修改文件
            config.server.port = 3001;
            writeFileSync(testConfigPath, JSON.stringify(config));

            // 第二次加载（应该使用缓存）
            const config2 = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            // 应该返回缓存的配置
            expect(config1.server.port).toBe(3000);
            expect(config2.server.port).toBe(3000);

            // 清除缓存后重新加载
            testConfigLoader.clearCache(testConfigPath);
            const config3 = testConfigLoader.loadConfig({
                configPath: testConfigPath,
            });

            // 现在应该返回新的配置
            expect(config3.server.port).toBe(3001);
        });
    });
});
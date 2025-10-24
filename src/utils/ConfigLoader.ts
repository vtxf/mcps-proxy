/**
 * 配置文件加载器
 * 使用Node.js内置模块，不依赖第三方库
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Config, ConfigLoadOptions, ConfigValidationError, ConfigValidationResult } from "@/types/ConfigTypes";
import { logger } from "./Logger";
import { transformMcpConfigForWindows } from "../mcpConfigTransformer";

export class ConfigLoader {
    private static instance: ConfigLoader;
    private configCache: Map<string, Config> = new Map();

    private constructor() {}

    public static getInstance(): ConfigLoader {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }

    /**
     * 加载配置文件
     */
    public loadConfig(options: ConfigLoadOptions = {}): Config {
        const configPath = this.getConfigPath(options);

        // 检查缓存
        if (this.configCache.has(configPath)) {
            logger.debug(`Using cached config from ${configPath}`);
            return this.configCache.get(configPath)!;
        }

        // 如果配置文件不存在，创建默认配置
        if (!existsSync(configPath)) {
            logger.info(`Config file not found at ${configPath}, creating default config`);
            const defaultConfig = this.createDefaultConfig();
            // 转换MCP配置以适配Windows系统
            const transformedConfig = transformMcpConfigForWindows(defaultConfig);
            this.saveConfig(defaultConfig, configPath);
            this.configCache.set(configPath, transformedConfig);
            return transformedConfig;
        }

        try {
            // 读取配置文件
            const configContent = readFileSync(configPath, "utf8");
            let config: Config;

            try {
                config = JSON.parse(configContent);
            } catch (parseError) {
                throw new Error(`Invalid JSON in config file: ${parseError}`);
            }

            // 替换环境变量
            if (options.replaceEnvVars !== false) {
                config = this.replaceEnvironmentVariables(config);
            }

            // 验证配置
            if (options.validateSchema !== false) {
                const validation = this.validateConfig(config);
                if (!validation.valid) {
                    const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join(", ");
                    throw new Error(`Config validation failed: ${errorMessages}`);
                }
            }

            // 转换MCP配置以适配Windows系统
            const transformedConfig = transformMcpConfigForWindows(config);

            this.configCache.set(configPath, transformedConfig);
            logger.info(`Config loaded successfully from ${configPath}`);
            return transformedConfig;

        } catch (error) {
            logger.error(`Failed to load config from ${configPath}:`, error);
            throw error;
        }
    }

    /**
     * 保存配置文件
     */
    public saveConfig(config: Config, configPath?: string): void {
        const targetPath = configPath || this.getDefaultConfigPath();

        try {
            // 确保目录存在
            const dir = dirname(targetPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            // 写入配置文件
            const configContent = JSON.stringify(config, null, 2);
            writeFileSync(targetPath, configContent, "utf8");

            logger.info(`Config saved to ${targetPath}`);

            // 更新缓存
            this.configCache.set(targetPath, config);

        } catch (error) {
            logger.error(`Failed to save config to ${targetPath}:`, error);
            throw error;
        }
    }

    /**
     * 清除配置缓存
     */
    public clearCache(configPath?: string): void {
        if (configPath) {
            this.configCache.delete(configPath);
        } else {
            this.configCache.clear();
        }
    }

    /**
     * 获取配置文件路径
     */
    private getConfigPath(options: ConfigLoadOptions): string {
        if (options.configPath) {
            return options.configPath;
        }
        return this.getDefaultConfigPath();
    }

    /**
     * 获取默认配置文件路径
     */
    private getDefaultConfigPath(): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE || "";
        return join(homeDir, ".mcps-proxy", "config.json");
    }

    /**
     * 创建默认配置
     */
    private createDefaultConfig(): Config {
        return {
            $schema: "./schema/config.schema.json",
            server: {
                port: 3095,
                host: "127.0.0.1",
                cors: {
                    enabled: true,
                    origins: ["*"],
                    methods: ["GET", "POST", "OPTIONS"],
                    credentials: false,
                    allowedHeaders: ["Content-Type", "Authorization"],
                },
            },
            cli: {
                stdio: {
                    encoding: "utf8",
                    delimiter: "\n",
                    timeout: 30000,
                },
            },
            schemas: {
                default: {
                    enabled: true,
                    mcpServers: {
                        filesystem: {
                            type: "stdio",
                            command: "npx",
                            args: ["@modelcontextprotocol/server-filesystem", "."],
                            env: {
                                NODE_ENV: "production",
                            },
                            timeout: 30000,
                            restart: true,
                        },
                    },
                },
                workspace: {
                    enabled: true,
                    mcpServers: {
                        git: {
                            type: "stdio",
                            command: "npx",
                            args: ["@modelcontextprotocol/server-git", "."],
                            env: {
                                NODE_ENV: "production",
                            },
                            timeout: 30000,
                            restart: true,
                        },
                    },
                },
                tools: {
                    enabled: true,
                    mcpServers: {
                        memory: {
                            type: "stdio",
                            command: "npx",
                            args: ["@modelcontextprotocol/server-memory"],
                            env: {
                                NODE_ENV: "production",
                            },
                            timeout: 30000,
                            restart: true,
                        },
                    },
                },
            },
            logging: {
                level: "info",
                file: "~/.mcps-proxy/logs/mcps-proxy.log",
                maxSize: "10MB",
                maxFiles: 5,
                console: true,
            },
        };
    }

    /**
     * 替换配置中的环境变量
     */
    private replaceEnvironmentVariables(config: any): any {
        if (typeof config !== "object" || config === null) {
            return config;
        }

        if (Array.isArray(config)) {
            return config.map(item => this.replaceEnvironmentVariables(item));
        }

        const result: any = {};
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === "string") {
                // 替换 ${VAR_NAME} 格式的环境变量
                result[key] = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
                    const envValue = process.env[varName];
                    if (envValue === undefined) {
                        logger.warn(`Environment variable ${varName} not found, keeping original value`);
                        return match;
                    }
                    return envValue;
                });
            } else if (typeof value === "object" && value !== null) {
                result[key] = this.replaceEnvironmentVariables(value);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * 验证配置文件
     */
    private validateConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = [];

        // 验证基础结构
        if (typeof config !== "object" || config === null) {
            errors.push({
                path: "root",
                message: "Config must be an object",
            });
            return { valid: false, errors };
        }

        // 验证server配置
        if (!config.server) {
            errors.push({
                path: "server",
                message: "Server configuration is required",
            });
        } else {
            const serverErrors = this.validateServerConfig(config.server);
            errors.push(...serverErrors);
        }

        // 验证cli配置（可选）
        if (config.cli) {
            const cliErrors = this.validateCLIConfig(config.cli);
            errors.push(...cliErrors);
        }

        // 验证schemas配置
        if (!config.schemas) {
            errors.push({
                path: "schemas",
                message: "Schemas configuration is required",
            });
        } else {
            const schemasErrors = this.validateSchemasConfig(config.schemas);
            errors.push(...schemasErrors);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * 验证服务器配置
     */
    private validateServerConfig(server: any): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        if (typeof server !== "object" || server === null) {
            errors.push({
                path: "server",
                message: "Server configuration must be an object",
            });
            return errors;
        }

        // 验证端口
        if (!server.port || typeof server.port !== "number") {
            errors.push({
                path: "server.port",
                message: "Port is required and must be a number",
            });
        } else if (server.port < 1 || server.port > 65535) {
            errors.push({
                path: "server.port",
                message: "Port must be between 1 and 65535",
            });
        }

        // 验证主机
        if (server.host && typeof server.host !== "string") {
            errors.push({
                path: "server.host",
                message: "Host must be a string",
            });
        }

        return errors;
    }

    /**
     * 验证CLI配置
     */
    private validateCLIConfig(cli: any): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        if (typeof cli !== "object" || cli === null) {
            errors.push({
                path: "cli",
                message: "CLI configuration must be an object",
            });
            return errors;
        }

        // 验证stdio配置（可选）
        if (cli.stdio) {
            const stdioErrors = this.validateSTDIOConfig(cli.stdio);
            errors.push(...stdioErrors);
        }

        return errors;
    }

    /**
     * 验证STDIO配置
     */
    private validateSTDIOConfig(stdio: any): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        if (typeof stdio !== "object" || stdio === null) {
            errors.push({
                path: "cli.stdio",
                message: "STDIO configuration must be an object",
            });
            return errors;
        }

        // 验证encoding
        if (stdio.encoding && typeof stdio.encoding !== "string") {
            errors.push({
                path: "cli.stdio.encoding",
                message: "Encoding must be a string",
            });
        }

        // 验证delimiter
        if (stdio.delimiter && typeof stdio.delimiter !== "string") {
            errors.push({
                path: "cli.stdio.delimiter",
                message: "Delimiter must be a string",
            });
        }

        // 验证timeout
        if (stdio.timeout && (typeof stdio.timeout !== "number" || stdio.timeout <= 0)) {
            errors.push({
                path: "cli.stdio.timeout",
                message: "Timeout must be a positive number",
            });
        }

        return errors;
    }

    /**
     * 验证schemas配置
     */
    private validateSchemasConfig(schemas: any): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        if (typeof schemas !== "object" || schemas === null) {
            errors.push({
                path: "schemas",
                message: "Schemas configuration must be an object",
            });
            return errors;
        }

        for (const [schemaName, schema] of Object.entries(schemas)) {
            const schemaErrors = this.validateSchemaConfig(schema, schemaName);
            errors.push(...schemaErrors);
        }

        return errors;
    }

    /**
     * 验证单个schema配置
     */
    private validateSchemaConfig(schema: any, schemaName: string): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];
        const basePath = `schemas.${schemaName}`;

        if (typeof schema !== "object" || schema === null) {
            errors.push({
                path: basePath,
                message: `Schema '${schemaName}' must be an object`,
            });
            return errors;
        }

        // 验证enabled字段（可选）
        if (schema.enabled !== undefined && typeof schema.enabled !== "boolean") {
            errors.push({
                path: `${basePath}.enabled`,
                message: "Enabled must be a boolean",
            });
        }

        // 验证mcpServers字段
        if (!schema.mcpServers) {
            errors.push({
                path: `${basePath}.mcpServers`,
                message: "mcpServers is required",
            });
        } else if (typeof schema.mcpServers !== "object" || schema.mcpServers === null) {
            errors.push({
                path: `${basePath}.mcpServers`,
                message: "mcpServers must be an object",
            });
        }

        return errors;
    }
}

// 导出单例实例
export const configLoader = ConfigLoader.getInstance();
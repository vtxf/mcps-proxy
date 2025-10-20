/**
 * 配置文件相关类型定义
 */

// 服务器基础配置
export interface ServerConfig {
    port: number;
    host?: string;
    cors?: CORSConfig;
}

// CORS配置
export interface CORSConfig {
    enabled: boolean;
    origins: string[];
    methods?: string[];
    credentials?: boolean;
    allowedHeaders?: string[];
}

// 日志配置
export interface LoggingConfig {
    level: "error" | "warn" | "info" | "debug";
    file?: string;
    maxSize?: string;
    maxFiles?: number;
    console?: boolean;
}

// STDIO类型MCP服务器配置
export interface StdioServerConfig {
    type: "stdio";
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    timeout?: number;
    restart?: boolean;
    restartDelay?: number;
}

// HTTP类型MCP服务器配置
export interface HTTPServerConfig {
    type: "http";
    url: string;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

// SSE类型MCP服务器配置
export interface SSEServerConfig {
    type: "sse";
    url: string;
    headers?: Record<string, string>;
    reconnectInterval?: number;
    maxRetries?: number;
    timeout?: number;
}

// MCP服务器配置联合类型
export type MCPServerConfig = StdioServerConfig | HTTPServerConfig | SSEServerConfig;

// Schema配置
export interface SchemaConfig {
    enabled?: boolean;
    mcpServers: Record<string, MCPServerConfig>;
}

// 主配置文件结构
export interface Config {
    $schema?: string;
    server: ServerConfig;
    schemas: Record<string, SchemaConfig>;
    logging?: LoggingConfig;
}

// 配置加载选项
export interface ConfigLoadOptions {
    configPath?: string;
    validateSchema?: boolean;
    replaceEnvVars?: boolean;
}

// 配置验证错误
export interface ConfigValidationError {
    path: string;
    message: string;
    value?: any;
}

// 配置验证结果
export interface ConfigValidationResult {
    valid: boolean;
    errors: ConfigValidationError[];
}

// 默认配置值
export const DEFAULT_CONFIG: Partial<Config> = {
    server: {
        port: 3095,
        host: "0.0.0.0",
        cors: {
            enabled: true,
            origins: ["*"],
            methods: ["GET", "POST", "OPTIONS"],
            credentials: false,
            allowedHeaders: ["Content-Type", "Authorization"],
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
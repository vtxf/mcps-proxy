/**
 * STDIO代理服务器实现
 * 通过标准输入输出接收客户端请求，转发给MCPConnectionManager处理
 */

import { MCPConnectionManager } from "./MCPConnectionManager";
import { MCPMethodHandler } from "./MCPMethodHandler";
import { logger } from "../utils/Logger";
import { STDIOConfig } from "../types/ConfigTypes";

// 移除重复的STDIOConfig接口定义，使用ConfigTypes中的定义

// JSON-RPC请求接口
interface JSONRPCRequest {
    jsonrpc: "2.0";
    method: string;
    params?: any;
    id?: string | number;
}

// JSON-RPC响应接口
interface JSONRPCResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id?: string | number | null;
}

export class StdioProxyServer {
    private connectionManager: MCPConnectionManager;
    private methodHandler: MCPMethodHandler;
    private config: STDIOConfig;
    private isRunning: boolean = false;
    private requestId: number = 1;
    private pendingRequests: Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private currentSchema: string = "default";
    private handleJsonRpcRequests: boolean = false;

    constructor(connectionManager: MCPConnectionManager, config?: STDIOConfig) {
        this.connectionManager = connectionManager;
        this.methodHandler = new MCPMethodHandler(connectionManager);
        this.config = {
            encoding: "utf8",
            delimiter: "\n",
            timeout: 30000,
            ...config
        };
    }

    /**
     * 启动STDIO服务
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn("STDIO proxy server is already running");
            return;
        }

        try {
            logger.info("Starting STDIO proxy server...");

            this.isRunning = true;

            // 先设置监听器，但不立即开始处理请求
            this.setupInputListeners();

            // 延迟一段时间后才开始处理JSON-RPC请求
            // 这样避免将启动过程中的日志误认为是JSON-RPC请求
            setTimeout(() => {
                this.setupRequestHandling();
            }, 2000); // 等待2秒让MCP服务器完全启动

            logger.info("STDIO proxy server started successfully");

        } catch (error) {
            logger.error("Failed to start STDIO proxy server:", error);
            throw error;
        }
    }

    /**
     * 停止STDIO服务
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            logger.info("Stopping STDIO proxy server...");

            // 清理所有待处理的请求
            for (const [id, request] of this.pendingRequests) {
                clearTimeout(request.timeout);
                request.reject(new Error("Server shutting down"));
            }
            this.pendingRequests.clear();

            this.isRunning = false;
            logger.info("STDIO proxy server stopped successfully");

        } catch (error) {
            logger.error("Error stopping STDIO proxy server:", error);
            throw error;
        }
    }

    /**
     * 检查运行状态
     */
    public isServerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 设置当前schema
     */
    public setCurrentSchema(schemaName: string): void {
        this.currentSchema = schemaName;
        logger.info(`STDIO proxy server schema set to: ${schemaName}`);
    }

    /**
     * 设置输入监听器
     */
    private setupInputListeners(): void {
        if (!process.stdin.isPaused()) {
            process.stdin.pause();
        }

        // 设置编码
        if (process.stdin.setEncoding) {
            process.stdin.setEncoding(this.config.encoding! as BufferEncoding);
        }

        // 监听标准输入
        process.stdin.on("data", (data: Buffer) => {
            this.handleRawInput(data.toString(this.config.encoding! as BufferEncoding));
        });

        // 处理输入结束
        process.stdin.on("end", () => {
            logger.info("STDIO input ended, shutting down server");
            this.stop();
        });

        // 恢复输入
        process.stdin.resume();
    }

    /**
     * 设置请求处理
     */
    private setupRequestHandling(): void {
        this.handleJsonRpcRequests = true;
    }

    /**
     * 处理原始输入数据
     */
    private handleRawInput(input: string): void {
        // 只在启动完成后才处理JSON-RPC请求
        if (!this.handleJsonRpcRequests) {
            return;
        }

        this.handleInput(input);
    }

    /**
     * 处理输入数据
     */
    private handleInput(input: string): void {
        if (!this.isRunning) {
            return;
        }

        try {
            // 按分隔符分割输入行
            const delimiter = this.config.delimiter!;
            const lines = input.includes(delimiter) ? input.split(delimiter) : [input];

            for (const line of lines) {
                if (!line.trim()) {
                    continue;
                }

                try {
                    const request = JSON.parse(line.trim()) as JSONRPCRequest;
                    this.handleRequest(request);
                } catch (parseError) {
                    logger.warn("Failed to parse JSON-RPC request:", line.trim());
                    this.sendError(null, -32700, "Parse error", { line: line.trim() });
                }
            }
        } catch (error) {
            logger.error("Error handling input:", error);
        }
    }

    /**
     * 处理JSON-RPC请求
     */
    private async handleRequest(request: JSONRPCRequest): Promise<void> {
        const requestId = request.id || this.requestId++;

        try {
            // 验证请求格式
            if (!request.method) {
                this.sendError(requestId, -32600, "Invalid Request", { reason: "method is required" });
                return;
            }

            logger.debug(`Processing JSON-RPC request: ${request.method}`, request.params);

            // 转发请求到MCPConnectionManager
            const result = await this.forwardToMCPConnectionManager(request.method, request.params);

            // 发送成功响应
            this.sendResponse(requestId, result);

        } catch (error) {
            logger.error(`Error handling request ${request.method}:`, error);

            let errorCode = -32603; // Internal error
            let errorMessage = "Internal error";

            if (error instanceof Error) {
                errorMessage = error.message;

                // 根据错误类型设置错误码
                if (error.message.includes("not found")) {
                    errorCode = -32602; // Invalid params
                } else if (error.message.includes("not supported")) {
                    errorCode = -32601; // Method not found
                }
            }

            this.sendError(requestId, errorCode, errorMessage, { originalError: error instanceof Error ? error.message : String(error) });
        }
    }

    /**
     * 转发请求到MCP处理器
     */
    private async forwardToMCPConnectionManager(method: string, params?: any): Promise<any> {
        return await this.methodHandler.handleMethod(this.currentSchema, method, params);
    }

    /**
     * 发送响应
     */
    private sendResponse(id: string | number, result: any): void {
        const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            result,
            id
        };

        this.sendOutput(response);
        logger.debug(`Sent response for request ${id}`);
    }

    /**
     * 发送错误响应
     */
    private sendError(id: string | number | null, code: number, message: string, data?: any): void {
        const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            error: {
                code,
                message,
                ...(data && { data })
            },
            id
        };

        this.sendOutput(response);
        logger.warn(`Sent error response for request ${id}: ${message}`);
    }

    /**
     * 输出响应到stdout
     */
    private sendOutput(response: JSONRPCResponse): void {
        try {
            const output = JSON.stringify(response) + this.config.delimiter;
            process.stdout.write(output);
        } catch (error) {
            logger.error("Failed to send output:", error);
        }
    }

    /**
     * 处理进程信号
     */
    public setupSignalHandlers(): void {
        // 处理SIGINT (Ctrl+C)
        process.on("SIGINT", async () => {
            logger.info("Received SIGINT, shutting down STDIO proxy server");
            await this.stop();
            process.exit(0);
        });

        // 处理SIGTERM
        process.on("SIGTERM", async () => {
            logger.info("Received SIGTERM, shutting down STDIO proxy server");
            await this.stop();
            process.exit(0);
        });
    }
}
/**
 * SSE类型的MCP服务器实现
 * 通过Server-Sent Events与MCP服务器通信
 */

import { EventEmitter } from "events";
import { IMCPServer } from "../interfaces/IMCPServer";
import {
    ToolListResult,
    ToolCallParams,
    ToolCallResult,
    ResourceListResult,
    ResourceReadParams,
    ResourceReadResult,
    PromptListResult,
    PromptGetParams,
    PromptGetResult,
    ServerStatus,
} from "../types/MCPTypes";
import { SSEServerConfig } from "../types/ConfigTypes";
import { logger } from "../utils/Logger";
import { EventSource } from "eventsource";

export class SSEMCPServer extends EventEmitter implements IMCPServer {
    public readonly id: string;
    public readonly config: SSEServerConfig;
    public status: ServerStatus;
    private eventSource?: EventSource;
    private requestId = 1;
    private pendingRequests: Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private statusChangeCallback?: (status: ServerStatus) => void;
    private reconnectAttempts = 0;
    private reconnectTimer?: NodeJS.Timeout;
    private messageEndpoint?: string; // 新增：消息端点URL

    constructor(id: string, config: SSEServerConfig) {
        super();
        this.id = id;
        this.config = config;
        this.status = {
            id,
            name: config.url,
            status: "disconnected",
            type: "sse",
            toolCount: 0,
        };
    }

    /**
     * 连接到MCP服务器
     */
    public async connect(): Promise<void> {
        if (this.status.status === "connected") {
            logger.warn(`SSE server '${this.id}' is already connected`);
            return;
        }

        try {
            logger.info(`Connecting to SSE server '${this.id}' at ${this.config.url}`);

            // 创建EventSource连接
            await this.createEventSource();

            // 等待连接就绪
            await this.waitForReady();

            this.updateStatus("connected");
            this.reconnectAttempts = 0;
            logger.info(`SSE server '${this.id}' connected successfully`);

        } catch (error) {
            this.updateStatus("error", error instanceof Error ? error.message : "Unknown error");
            logger.error(`Failed to connect SSE server '${this.id}':`, error);

            // 如果配置了自动重连
            if (this.reconnectAttempts < (this.config.maxRetries || 5)) {
                this.scheduleReconnect();
            }

            throw error;
        }
    }

    /**
     * 断开连接
     */
    public async disconnect(): Promise<void> {
        if (this.status.status === "disconnected") {
            return;
        }

        try {
            // 取消重连定时器
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = undefined;
            }

            // 清理所有待处理的请求
            for (const [id, request] of this.pendingRequests) {
                clearTimeout(request.timeout);
                request.reject(new Error("Server disconnected"));
            }
            this.pendingRequests.clear();

            // 关闭EventSource
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = undefined;
            }

            // 清理消息端点
            this.messageEndpoint = undefined;

            this.updateStatus("disconnected");
            logger.info(`SSE server '${this.id}' disconnected`);

        } catch (error) {
            logger.error(`Error disconnecting SSE server '${this.id}':`, error);
            throw error;
        }
    }

    /**
     * 检查连接状态
     */
    public isConnected(): boolean {
        return this.eventSource !== undefined &&
               this.eventSource.readyState === EventSource.OPEN;
    }

    /**
     * 获取工具列表
     */
    public async listTools(): Promise<ToolListResult> {
        return this.sendRequest("tools/list", {});
    }

    /**
     * 调用工具
     */
    public async callTool(params: ToolCallParams): Promise<ToolCallResult> {
        return this.sendRequest("tools/call", params);
    }

    /**
     * 获取资源列表
     */
    public async listResources(): Promise<ResourceListResult> {
        return this.sendRequest("resources/list", {});
    }

    /**
     * 读取资源
     */
    public async readResource(params: ResourceReadParams): Promise<ResourceReadResult> {
        return this.sendRequest("resources/read", params);
    }

    /**
     * 获取提示列表
     */
    public async listPrompts(): Promise<PromptListResult> {
        return this.sendRequest("prompts/list", {});
    }

    /**
     * 获取提示内容
     */
    public async getPrompt(params: PromptGetParams): Promise<PromptGetResult> {
        return this.sendRequest("prompts/get", params);
    }

    /**
     * 获取服务器状态
     */
    public getStatus(): ServerStatus {
        return { ...this.status };
    }

    /**
     * 设置状态变化回调
     */
    public onStatusChange(callback: (status: ServerStatus) => void): void {
        this.statusChangeCallback = callback;
    }

    /**
     * 创建EventSource连接
     */
    private async createEventSource(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // 注意：在Node.js环境中，可能需要使用polyfill或EventSource的替代实现
                // eventsource polyfill支持传递headers参数
                logger.debug(`SSE server '${this.id}' connecting with headers:`, this.config.headers);
                const eventSourceOptions: any = {
                    headers: this.config.headers
                };
                this.eventSource = new EventSource(this.config.url, eventSourceOptions);

                // 设置事件监听器
                this.eventSource.onopen = () => {
                    logger.debug(`SSE connection opened for server '${this.id}'`);
                    resolve();
                };

                this.eventSource.onmessage = (event) => {
                    this.handleMessage(event);
                };

                // 监听特定事件类型
                this.eventSource.addEventListener('endpoint', (event) => {
                    logger.debug(`Received endpoint event for server '${this.id}'`);
                    this.handleMessage(event);
                });

                this.eventSource.onerror = (event) => {
                    logger.error(`SSE error for server '${this.id}':`, event);

                    if (this.eventSource?.readyState === EventSource.CLOSED) {
                        this.updateStatus("error", "SSE connection closed");

                        // 尝试重连
                        if (this.reconnectAttempts < (this.config.maxRetries || 5)) {
                            this.scheduleReconnect();
                        }
                    }

                    if (this.status.status !== "connected") {
                        reject(new Error("Failed to establish SSE connection"));
                    }
                };

                // 设置连接超时
                setTimeout(() => {
                    if (this.eventSource?.readyState !== EventSource.OPEN) {
                        reject(new Error("SSE connection timeout"));
                    }
                }, this.config.timeout || 30000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 处理SSE消息
     */
    private handleMessage(event: any): void {
        try {
            const data = event.data;
            if (!data || typeof data !== "string") {
                return;
            }

            // 处理endpoint事件
            if (event.type === 'endpoint' || event.event === 'endpoint') {
                this.messageEndpoint = data;
                logger.info(`SSE server '${this.id}' received message endpoint: ${this.messageEndpoint}`);
                return;
            }

            // 处理JSON-RPC响应
            const message = JSON.parse(data);
            this.handleResponse(message);

        } catch (error) {
            logger.error(`Failed to handle SSE message from server '${this.id}'. Raw data:`, event.data, error);
        }
    }

    /**
     * 处理JSON-RPC响应
     */
    private handleResponse(response: any): void {
        logger.debug(`Received response from SSE server '${this.id}':`, response);

        const { id, result, error } = response;

        if (id === undefined) {
            // 这是一个通知，可以忽略或处理
            logger.debug(`Received notification from SSE server '${this.id}':`, response);
            this.emit("notification", response);
            return;
        }

        const request = this.pendingRequests.get(id);
        if (!request) {
            logger.warn(`Received response for unknown request ${id} from SSE server '${this.id}'. Response:`, response);
            return;
        }

        // 清理超时和待处理请求
        clearTimeout(request.timeout);
        this.pendingRequests.delete(id);

        if (error) {
            const errorMessage = error.message || error.code || "Unknown error";
            logger.error(`Request ${id} failed for SSE server '${this.id}':`, error);
            request.reject(new Error(errorMessage));
        } else {
            request.resolve(result);
        }
    }

    /**
     * 发送请求（SSE服务器通常通过HTTP POST发送请求，通过SSE接收响应）
     */
    private async sendRequest(method: string, params: any): Promise<any> {
        if (!this.isConnected()) {
            throw new Error(`SSE server '${this.id}' is not connected`);
        }

        const id = this.requestId++;
        const request = {
            jsonrpc: "2.0",
            method,
            params,
            id,
        };

        return new Promise((resolve, reject) => {
            // 设置超时
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, this.config.timeout || 30000);

            // 存储待处理的请求
            this.pendingRequests.set(id, { resolve, reject, timeout });

            // 通过HTTP POST发送请求
            this.sendHttpRequest(request).catch(error => {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(error);
            });
        });
    }

    /**
     * 发送通知（无响应的请求）
     */
    private async sendNotification(method: string, params?: any): Promise<void> {
        if (!this.isConnected()) {
            throw new Error(`SSE server '${this.id}' is not connected`);
        }

        const request = {
            jsonrpc: "2.0",
            method,
            params,
        };

        // 通知不需要ID，也不需要等待响应
        await this.sendHttpRequest(request);
    }

    /**
     * 发送HTTP请求
     */
    private async sendHttpRequest(request: any): Promise<void> {
        try {
            if (!this.messageEndpoint) {
                throw new Error(`Message endpoint not available for SSE server '${this.id}'`);
            }

            // 构建完整的消息URL
            const baseUrl = new URL(this.config.url);
            const messageUrl = new URL(this.messageEndpoint, baseUrl.origin);

            logger.debug(`Sending HTTP request to SSE server '${this.id}' at URL: ${messageUrl.toString()}`);
            logger.debug(`Request body:`, JSON.stringify(request, null, 2));

            const response = await fetch(messageUrl.toString(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.config.headers,
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                logger.error(`HTTP error ${response.status} ${response.statusText} from SSE server '${this.id}'`);
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }

            logger.debug(`HTTP request sent successfully to SSE server '${this.id}'`);

            // 响应将通过SSE接收，这里不需要处理返回内容

        } catch (error) {
            logger.error(`Failed to send HTTP request to SSE server '${this.id}':`, error);
            throw error;
        }
    }

    /**
     * 等待服务器就绪
     */
    private async waitForReady(): Promise<void> {
        try {
            // 临时设置debug日志级别
            logger.setLevel("debug");

            // 等待messageEndpoint就绪
            const maxWaitTime = 10000; // 最多等待10秒
            const startTime = Date.now();

            logger.debug(`Waiting for message endpoint for SSE server '${this.id}'...`);

            while (!this.messageEndpoint && Date.now() - startTime < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!this.messageEndpoint) {
                throw new Error(`Failed to receive message endpoint for SSE server '${this.id}'`);
            }

            logger.debug(`Message endpoint received: ${this.messageEndpoint}`);

            // 首先发送初始化请求
            logger.debug(`Sending initialize request to SSE server '${this.id}'...`);
            await this.sendRequest("initialize", {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {}
                },
                clientInfo: {
                    name: "mcps-proxy",
                    version: "1.0.1"
                }
            });

            // 发送initialized通知
            logger.debug(`Sending initialized notification to SSE server '${this.id}'...`);
            await this.sendNotification("initialized");

            // 尝试获取工具列表来验证连接
            logger.debug(`Sending tools/list request to SSE server '${this.id}'...`);
            await this.sendRequest("tools/list", {});

            // 更新工具数量
            const toolsResult = await this.listTools();
            this.status.toolCount = toolsResult.tools.length;

            logger.debug(`SSE server '${this.id}' is ready with ${this.status.toolCount} tools`);

        } catch (error) {
            logger.error(`SSE server '${this.id}' not ready:`, error);
            throw error;
        }
    }

    /**
     * 安排重连
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval || 1000;

        logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} for SSE server '${this.id}' in ${delay}ms`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error(`Reconnect attempt ${this.reconnectAttempts} failed for SSE server '${this.id}':`, error);
            }
        }, delay);
    }

    /**
     * 更新服务器状态
     */
    private updateStatus(status: "connected" | "disconnected" | "error", error?: string): void {
        const oldStatus = this.status.status;

        this.status.status = status;
        this.status.lastConnected = status === "connected" ? new Date() : this.status.lastConnected;
        this.status.lastError = status === "error" ? new Date() : this.status.lastError;

        if (error) {
            this.status.error = error;
        } else {
            delete this.status.error;
        }

        // 如果状态发生变化，调用回调
        if (oldStatus !== status && this.statusChangeCallback) {
            this.statusChangeCallback({ ...this.status });
        }
    }
}
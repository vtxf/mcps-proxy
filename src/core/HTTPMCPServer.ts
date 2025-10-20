/**
 * HTTP类型的MCP服务器实现
 * 通过HTTP API与MCP服务器通信
 */

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
import { HTTPServerConfig } from "../types/ConfigTypes";
import { logger } from "../utils/Logger";

export class HTTPMCPServer implements IMCPServer {
    public readonly id: string;
    public readonly config: HTTPServerConfig;
    public status: ServerStatus;
    private requestId = 1;
    private statusChangeCallback?: (status: ServerStatus) => void;

    constructor(id: string, config: HTTPServerConfig) {
        this.id = id;
        this.config = config;
        this.status = {
            id,
            name: config.url,
            status: "disconnected",
            type: "http",
            toolCount: 0,
        };
    }

    /**
     * 连接到MCP服务器
     */
    public async connect(): Promise<void> {
        if (this.status.status === "connected") {
            logger.warn(`HTTP server '${this.id}' is already connected`);
            return;
        }

        try {
            logger.info(`Connecting to HTTP server '${this.id}' at ${this.config.url}`);

            // 测试连接
            await this.testConnection();

            // 获取工具数量
            const toolsResult = await this.listTools();
            this.status.toolCount = toolsResult.tools.length;

            this.updateStatus("connected");
            logger.info(`HTTP server '${this.id}' connected successfully`);

        } catch (error) {
            this.updateStatus("error", error instanceof Error ? error.message : "Unknown error");
            logger.error(`Failed to connect HTTP server '${this.id}':`, error);
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
            this.updateStatus("disconnected");
            logger.info(`HTTP server '${this.id}' disconnected`);

        } catch (error) {
            logger.error(`Error disconnecting HTTP server '${this.id}':`, error);
            throw error;
        }
    }

    /**
     * 检查连接状态
     */
    public isConnected(): boolean {
        return this.status.status === "connected";
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
     * 测试连接
     */
    private async testConnection(): Promise<void> {
        try {
            // 发送一个简单的请求来测试连接
            await this.sendRequest("tools/list", {}, 5000);
        } catch (error) {
            throw new Error(`Connection test failed: ${error}`);
        }
    }

    /**
     * 发送HTTP请求
     */
    private async sendRequest(method: string, params: any, timeout?: number): Promise<any> {
        if (!this.isConnected()) {
            throw new Error(`HTTP server '${this.id}' is not connected`);
        }

        const id = this.requestId++;
        const request = {
            jsonrpc: "2.0",
            method,
            params,
            id,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout || this.config.timeout || 10000);

        try {
            const response = await fetch(this.config.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.config.headers,
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();

            if (!responseText.trim()) {
                throw new Error("Empty response from server");
            }

            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (responseData.error) {
                throw new Error(responseData.error.message || "Unknown server error");
            }

            return responseData.result;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Request timeout: ${method}`);
            }

            throw error;
        }
    }

    /**
     * 带重试的请求发送
     */
    private async sendRequestWithRetry(method: string, params: any): Promise<any> {
        const maxRetries = this.config.retries || 3;
        const retryDelay = this.config.retryDelay || 1000;

        let lastError: Error = new Error("Unknown error");

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.sendRequest(method, params);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown error");

                if (attempt < maxRetries) {
                    logger.warn(`HTTP server '${this.id}' request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
                    await this.delay(retryDelay);
                }
            }
        }

        throw lastError;
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
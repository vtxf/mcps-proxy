/**
 * STDIO类型的MCP服务器实现
 * 通过标准输入输出与MCP服务器进程通信
 */

import { spawn, ChildProcess } from "child_process";
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
import { StdioServerConfig } from "../types/ConfigTypes";
import { logger } from "../utils/Logger";

export class StdioMCPServer implements IMCPServer {
    public readonly id: string;
    public readonly config: StdioServerConfig;
    public status: ServerStatus;
    private process?: ChildProcess;
    private requestId = 1;
    private pendingRequests: Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private statusChangeCallback?: (status: ServerStatus) => void;

    constructor(id: string, config: StdioServerConfig) {
        this.id = id;
        this.config = config;
        this.status = {
            id,
            name: config.command,
            status: "disconnected",
            type: "stdio",
            toolCount: 0,
        };
    }

    /**
     * 连接到MCP服务器
     */
    public async connect(): Promise<void> {
        if (this.status.status === "connected") {
            logger.warn(`STDIO server '${this.id}' is already connected`);
            return;
        }

        try {
            logger.info(`Connecting to STDIO server '${this.id}' with command: ${this.config.command}`);

            // 启动子进程
            this.process = spawn(this.config.command, this.config.args || [], {
                env: { ...process.env, ...this.config.env },
                cwd: this.config.cwd || process.cwd(),
                stdio: ["pipe", "pipe", "pipe"],
            });

            // 设置进程事件监听
            this.setupProcessListeners();

            // 等待连接就绪
            await this.waitForReady();

            this.updateStatus("connected");
            logger.info(`STDIO server '${this.id}' connected successfully`);

        } catch (error) {
            this.updateStatus("error", error instanceof Error ? error.message : "Unknown error");
            logger.error(`Failed to connect STDIO server '${this.id}':`, error);
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
            // 清理所有待处理的请求
            for (const [id, request] of this.pendingRequests) {
                clearTimeout(request.timeout);
                request.reject(new Error("Server disconnected"));
            }
            this.pendingRequests.clear();

            // 终止进程
            if (this.process) {
                this.process.kill("SIGTERM");

                // 等待进程正常退出
                await new Promise<void>((resolve) => {
                    if (this.process) {
                        this.process.once("exit", () => resolve());
                    } else {
                        resolve();
                    }
                });

                // 如果进程还在运行，强制终止
                if (this.process && !this.process.killed) {
                    this.process.kill("SIGKILL");
                }
            }

            this.updateStatus("disconnected");
            logger.info(`STDIO server '${this.id}' disconnected`);

        } catch (error) {
            logger.error(`Error disconnecting STDIO server '${this.id}':`, error);
            throw error;
        }
    }

    /**
     * 检查连接状态
     */
    public isConnected(): boolean {
        return this.status.status === "connected" &&
               this.process !== undefined &&
               !this.process.killed;
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
     * 发送JSON-RPC请求
     */
    private async sendRequest(method: string, params: any): Promise<any> {
        if (!this.process || this.process.killed) {
            throw new Error(`STDIO server '${this.id}' process is not running`);
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

            // 发送请求
            if (this.process?.stdin) {
                try {
                    this.process.stdin.write(JSON.stringify(request) + "\n");
                } catch (error) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(id);
                    reject(error);
                }
            } else {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(new Error("STDIN is not available"));
            }
        });
    }

    /**
     * 设置进程事件监听
     */
    private setupProcessListeners(): void {
        if (!this.process) {
            return;
        }

        // 处理标准输出
        this.process.stdout?.on("data", (data: Buffer) => {
            this.handleOutput(data.toString());
        });

        // 处理标准错误
        this.process.stderr?.on("data", (data: Buffer) => {
            logger.error(`STDIO server '${this.id}' stderr:`, data.toString());
        });

        // 处理进程退出
        this.process.on("exit", (code: number | null, signal: string | null) => {
            logger.warn(`STDIO server '${this.id}' exited with code ${code}, signal ${signal}`);
            this.updateStatus("disconnected");

            // 如果配置了自动重启
            if (this.config.restart && code !== 0) {
                logger.info(`Attempting to restart STDIO server '${this.id}'...`);
                setTimeout(() => {
                    this.connect().catch(error => {
                        logger.error(`Failed to restart STDIO server '${this.id}':`, error);
                    });
                }, this.config.restartDelay || 5000);
            }
        });

        // 处理进程错误
        this.process.on("error", (error: Error) => {
            logger.error(`STDIO server '${this.id}' process error:`, error);
            this.updateStatus("error", error.message);
        });
    }

    /**
     * 处理进程输出
     */
    private handleOutput(output: string): void {
        try {
            const lines = output.trim().split("\n");

            for (const line of lines) {
                if (!line.trim()) {
                    continue;
                }

                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                } catch (parseError) {
                    logger.warn(`Failed to parse output from STDIO server '${this.id}':`, line);
                }
            }
        } catch (error) {
            logger.error(`Error handling output from STDIO server '${this.id}':`, error);
        }
    }

    /**
     * 处理JSON-RPC响应
     */
    private handleResponse(response: any): void {
        const { id, result, error } = response;

        if (id === undefined) {
            // 这是一个通知，忽略
            return;
        }

        const request = this.pendingRequests.get(id);
        if (!request) {
            logger.warn(`Received response for unknown request ${id} from STDIO server '${this.id}'`);
            return;
        }

        // 清理超时和待处理请求
        clearTimeout(request.timeout);
        this.pendingRequests.delete(id);

        if (error) {
            request.reject(new Error(error.message || "Unknown error"));
        } else {
            request.resolve(result);
        }
    }

    /**
     * 等待服务器就绪
     */
    private async waitForReady(): Promise<void> {
        try {
            // 等待一小段时间让进程启动
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 发送初始化请求
            await this.sendRequest("initialize", {
                protocolVersion: "2024-11-05",
                capabilities: {
                    roots: { listChanged: true },
                    sampling: {}
                },
                clientInfo: {
                    name: "mcps-proxy",
                    version: "1.0.0"
                }
            });

            // 获取工具列表来验证连接
            const toolsResult = await this.listTools();
            this.status.toolCount = toolsResult.tools.length;

        } catch (error) {
            logger.error(`STDIO server '${this.id}' not ready:`, error);
            throw error;
        }
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
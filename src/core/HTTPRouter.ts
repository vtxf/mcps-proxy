/**
 * HTTP路由器
 * 处理HTTP请求并路由到相应的MCP处理器
 */

import { Request, Response, NextFunction } from "express";
import { IHTTPRouter } from "../interfaces/IHTTPRouter";
import { JSONRPCHandler } from "./JSONRPCHandler";
import { MCPConnectionManager } from "./MCPConnectionManager";
import { notificationManager } from "./NotificationManager";
import {
    APIStatus,
    ProgressToken,
    Cursor,
    ResourceSubscribeResult,
    CompletionResult,
    CompletionValue,
    ListRootsResult,
    Root,
    CreateMessageResult,
    ElicitResult,
    PingResult
} from "../types/MCPTypes";
import { logger } from "../utils/Logger";

export class HTTPRouter implements IHTTPRouter {
    private jsonRpcHandler: JSONRPCHandler;
    private progressCallbacks: Map<ProgressToken, (response: Response) => void> = new Map();

    constructor(
        private connectionManager: MCPConnectionManager,
        private startTime: Date = new Date()
    ) {
        this.jsonRpcHandler = new JSONRPCHandler();
    }

    /**
     * 设置路由
     */
    public setupRoutes(): void {
        // 这个方法将在Express应用中使用
        // 实际的路由设置将在HTTPServer类中完成
    }

    /**
     * 处理MCP协议请求
     */
    public async handleMCPRequest(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const schemaName = req.params.schema;
            const requestData = req.body;

            logger.debug(`Received MCP request for schema '${schemaName}'`, {
                method: requestData.method,
                id: requestData.id,
            });

            // 验证schema是否存在且启用
            if (!this.connectionManager.hasSchema(schemaName)) {
                const errorResponse = this.jsonRpcHandler.createErrorResponse(
                    requestData.id || null,
                    404,
                    `Schema '${schemaName}' not found or disabled`
                );
                res.status(404).json(errorResponse);
                return;
            }

            // 解析JSON-RPC请求
            const request = this.jsonRpcHandler.parseRequest(JSON.stringify(requestData));
            if (!request) {
                const errorResponse = this.jsonRpcHandler.createInvalidRequestResponse(requestData.id || null);
                res.status(400).json(errorResponse);
                return;
            }

            // 检查是否有进度令牌
            const progressToken = this.jsonRpcHandler.extractProgressToken(request);
            if (progressToken) {
                // 注册进度回调
                this.progressCallbacks.set(progressToken, (response: Response) => {
                    // 这里可以实现服务器发送事件(SSE)来推送进度
                    logger.debug(`Progress notification available for token: ${progressToken}`);
                });
            }

            // 提取分页游标
            const cursor = request.params?.cursor as Cursor | undefined;

            // 处理不同的MCP方法
            const result = await this.handleMCPMethod(schemaName, request.method, request.params || {}, cursor);

            // 清理进度回调
            if (progressToken) {
                this.progressCallbacks.delete(progressToken);
            }

            // 通知没有响应，返回200状态码和空内容
            if (request.id === undefined) {
                res.status(200).json({});
                return;
            }

            const response = this.jsonRpcHandler.createResponseWithMeta(request.id, result);
            res.json(response);

            logger.debug(`MCP request completed successfully`, {
                method: request.method,
                id: request.id,
            });

        } catch (error) {
            logger.error("Error handling MCP request:", error);

            const errorResponse = this.jsonRpcHandler.createInternalErrorResponse(
                req.body?.id || null,
                error instanceof Error ? error.message : "Unknown error"
            );
            res.status(500).json(errorResponse);
        }
    }

    /**
     * 处理状态查询请求
     */
    public async handleStatusRequest(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const status = this.getAPIStatus();
            res.json(status);
        } catch (error) {
            logger.error("Error handling status request:", error);
            res.status(500).json({
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    /**
     * 处理CORS预检请求
     */
    public handleOptionsRequest(req: Request, res: Response): void {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.header("Access-Control-Allow-Credentials", "false");
        res.sendStatus(200);
    }

    /**
     * 处理具体的MCP方法
     */
    private async handleMCPMethod(
        schemaName: string,
        method: string,
        params: any,
        cursor?: Cursor
    ): Promise<any> {
        switch (method) {
            case "initialize":
                // 处理初始化请求
                return this.handleInitialize(schemaName, params);

            case "notifications/initialized":
                // 处理初始化完成通知 - 通知不应该有响应
                logger.info(`Received initialized notification for schema: ${schemaName}`);
                return null;

            case "logging/setLevel":
                // 处理日志级别设置通知
                return this.handleSetLevel(schemaName, params);

            case "tools/list":
                return await this.connectionManager.listTools(schemaName, cursor);

            case "tools/call":
                if (!params.name) {
                    throw new Error("Tool name is required for tools/call");
                }
                return await this.connectionManager.callTool(schemaName, params);

            case "resources/list":
                return await this.connectionManager.listResources(schemaName, cursor);

            case "resources/read":
                if (!params.uri) {
                    throw new Error("Resource URI is required for resources/read");
                }
                return await this.connectionManager.readResource(schemaName, params);

            case "resources/templates/list":
                return await this.connectionManager.listResourceTemplates(schemaName, cursor);

            case "prompts/list":
                return await this.connectionManager.listPrompts(schemaName);

            case "prompts/get":
                if (!params.name) {
                    throw new Error("Prompt name is required for prompts/get");
                }
                return await this.connectionManager.getPrompt(schemaName, params);

            case "ping":
                return this.handlePing(schemaName, params);

            case "resources/subscribe":
                if (!params.uri) {
                    throw new Error("Resource URI is required for resources/subscribe");
                }
                return this.handleResourceSubscribe(schemaName, params);

            case "resources/unsubscribe":
                if (!params.uri) {
                    throw new Error("Resource URI is required for resources/unsubscribe");
                }
                return this.handleResourceUnsubscribe(schemaName, params);

            case "completion/complete":
                if (!params.ref) {
                    throw new Error("Reference is required for completion/complete");
                }
                return this.handleCompletion(schemaName, params);

            case "roots/list":
                return this.handleListRoots(schemaName, params);

            case "sampling/createMessage":
                if (!params.messages || !Array.isArray(params.messages)) {
                    throw new Error("Messages array is required for sampling/createMessage");
                }
                return this.handleCreateMessage(schemaName, params);

            case "elicitation/create":
                if (!params.message) {
                    throw new Error("Message is required for elicitation/create");
                }
                return this.handleElicitation(schemaName, params);

            default:
                throw new Error(`Unsupported method: ${method}`);
        }
    }

    /**
     * 处理initialize请求
     */
    private async handleInitialize(schemaName: string, params: any): Promise<any> {
        logger.info(`Initializing connection for schema: ${schemaName}`, {
            clientInfo: params.clientInfo,
            protocolVersion: params.protocolVersion,
            capabilities: params.capabilities
        });

        try {
            // 检查客户端协议版本兼容性
            if (params.protocolVersion && params.protocolVersion !== "2025-06-18") {
                logger.warn(`Client protocol version ${params.protocolVersion} differs from server version 2025-06-18`);
            }

            // 检查schema是否存在
            if (!this.connectionManager.hasSchema(schemaName)) {
                throw new Error(`Schema '${schemaName}' not found`);
            }

            // 获取schema状态
            const schemaStatus = this.connectionManager.getSchemaStatus(schemaName);
            if (schemaStatus.connectedServers === 0) {
                // 没有连接的服务器，尝试连接所有服务器
                const schema = this.connectionManager.getSchema(schemaName);
                await schema.connectAll();
            }

            // 获取最新的schema状态
            const updatedSchemaStatus = this.connectionManager.getSchemaStatus(schemaName);

            // 构建服务器能力信息
            const capabilities = {
                tools: {
                    listChanged: true, // 支持工具列表变化通知
                },
                resources: {
                    subscribe: false, // 暂不支持资源订阅
                    listChanged: true, // 支持资源列表变化通知
                },
                prompts: {
                    listChanged: true, // 支持提示列表变化通知
                },
                logging: {}, // 支持日志级别设置
                experimental: {
                    // 实验性功能
                    pagination: true,
                    progress: true,
                }
            };

            // 返回MCP服务器能力信息
            return {
                protocolVersion: "2025-06-18",
                capabilities,
                serverInfo: {
                    name: `mcps-proxy-${schemaName}`,
                    version: "1.0.0"
                },
                instructions: `MCP Proxy Server for schema '${schemaName}'. This proxy provides access to ${updatedSchemaStatus.mcpServers.length} MCP servers with ${updatedSchemaStatus.totalTools} total tools.

Available features:
- tools/list: List all available tools (supports pagination)
- tools/call: Execute tools with format: serverId-toolName
- resources/list: List available resources (supports pagination)
- resources/read: Read resource content
- prompts/list: List available prompts (supports pagination)
- prompts/get: Get prompt content

Current status: ${updatedSchemaStatus.connectedServers}/${updatedSchemaStatus.mcpServers.length} servers connected.

Use tools/list to see all available tools from connected servers.`
            };
        } catch (error) {
            logger.error(`Failed to initialize schema '${schemaName}':`, error);
            throw error;
        }
    }

    /**
     * 处理logging/setLevel请求
     */
    private handleSetLevel(schemaName: string, params: any): any {
        if (!params.level) {
            logger.warn("Missing level parameter in logging/setLevel request");
            throw new Error("Level parameter is required");
        }

        try {
            // 设置全局日志级别
            logger.setLevel(params.level);

            logger.info(`Log level set to '${params.level}' for schema: ${schemaName}`);
            // 根据MCP 2025-06-18协议，logging/setLevel应该返回空结果
            return {};
        } catch (error) {
            logger.error(`Failed to set log level for schema '${schemaName}':`, error);
            throw error;
        }
    }

    /**
     * 获取API状态信息
     */
    private getAPIStatus(): APIStatus {
        const schemas = this.connectionManager.getAllSchemaStatus();
        const summary = this.calculateSummary(schemas);

        return {
            server: {
                status: "running",
                port: Number(process.env.PORT) || 3095,
                url: `http://localhost:${process.env.PORT || 3095}`,
                uptime: this.getUptime(),
            },
            schemas,
            summary,
        };
    }

    /**
     * 计算汇总信息
     */
    private calculateSummary(schemas: Record<string, any>): any {
        const schemaNames = Object.keys(schemas);
        const activeSchemas = schemaNames.filter(name => schemas[name].status === "active");

        let totalServers = 0;
        let connectedServers = 0;
        let failedServers = 0;
        let totalTools = 0;

        for (const schema of activeSchemas) {
            const schemaData = schemas[schema];
            totalServers += schemaData.mcpServers.length;
            connectedServers += schemaData.connectedServers;
            failedServers += schemaData.mcpServers.filter((s: any) => s.status === "error").length;
            totalTools += schemaData.totalTools;
        }

        return {
            totalSchemas: schemaNames.length,
            activeSchemas: activeSchemas.length,
            totalServers,
            connectedServers,
            failedServers,
            totalTools,
        };
    }

    /**
     * 处理ping请求
     */
    private handlePing(schemaName: string, params: any): any {
        logger.debug(`Ping request for schema: ${schemaName}`);

        // 根据MCP规范，ping方法应该返回一个简单的空对象或者不返回任何内容
        // 详细的状态信息应该通过status端点获取
        return {};
    }

    /**
     * 处理资源订阅请求
     */
    private handleResourceSubscribe(schemaName: string, params: any): ResourceSubscribeResult {
        logger.info(`Subscribe request for resource: ${params.uri} in schema: ${schemaName}`);

        const success = notificationManager.subscribeResource(params.uri);

        if (success) {
            // 发送日志消息通知
            notificationManager.sendLoggingMessageNotification(
                "info",
                `Subscribed to resource: ${params.uri}`,
                "resource-manager"
            );
        }

        return {
            success,
            message: success ? `Successfully subscribed to ${params.uri}` : `Failed to subscribe to ${params.uri}`
        };
    }

    /**
     * 处理资源取消订阅请求
     */
    private handleResourceUnsubscribe(schemaName: string, params: any): ResourceSubscribeResult {
        logger.info(`Unsubscribe request for resource: ${params.uri} in schema: ${schemaName}`);

        const success = notificationManager.unsubscribeResource(params.uri);

        if (success) {
            // 发送日志消息通知
            notificationManager.sendLoggingMessageNotification(
                "info",
                `Unsubscribed from resource: ${params.uri}`,
                "resource-manager"
            );
        }

        return {
            success,
            message: success ? `Successfully unsubscribed from ${params.uri}` : `Failed to unsubscribe from ${params.uri}`
        };
    }

    /**
     * 处理自动补全请求
     */
    private async handleCompletion(schemaName: string, params: any): Promise<CompletionResult> {
        logger.debug(`Completion request for reference:`, params.ref);

        const values: CompletionValue[] = [];

        try {
            if (params.ref.type === "ref/prompt") {
                // 获取提示相关的补全建议
                const prompts = await this.connectionManager.listPrompts(schemaName);
                values.push(...prompts.prompts.map(prompt => ({
                    value: prompt.name,
                    description: prompt.description
                })));
            } else if (params.ref.type === "ref/resource") {
                // 获取资源相关的补全建议
                const resources = await this.connectionManager.listResources(schemaName);
                values.push(...resources.resources.map(resource => ({
                    value: resource.uri,
                    description: resource.description || `Resource: ${resource.name}`
                })));
            }

            // 如果指定了具体参数，进行过滤
            if (params.argument && params.argument.name) {
                const filtered = values.filter(value =>
                    value.value && value.value.toString().toLowerCase().includes(params.argument.name.toLowerCase())
                );
                return {
                    values: filtered,
                    total: filtered.length
                };
            }

            return {
                values,
                total: values.length
            };
        } catch (error) {
            logger.error("Error in completion request:", error);
            return {
                values: [],
                total: 0
            };
        }
    }

    /**
     * 处理根目录列表请求
     */
    private handleListRoots(schemaName: string, params: any): ListRootsResult {
        logger.debug(`Roots list request for schema: ${schemaName}`);

        const roots: Root[] = [
            {
                uri: "file:///",
                name: "File System Root"
            },
            {
                uri: "http://localhost",
                name: "Local HTTP Server"
            }
        ];

        // 添加schema相关的根目录
        const schema = this.connectionManager.getSchema(schemaName);
        if (schema) {
            roots.push({
                uri: `schema://${schemaName}`,
                name: `Schema: ${schemaName}`
            });
        }

        return {
            roots
        };
    }

    /**
     * 处理创建消息请求（采样）
     */
    private async handleCreateMessage(schemaName: string, params: any): Promise<CreateMessageResult> {
        logger.debug(`Create message request for schema: ${schemaName}`, {
            messageCount: params.messages?.length,
            maxTokens: params.maxTokens,
            temperature: params.temperature
        });

        try {
            // 这里是一个简化的实现，实际应用中可能需要集成LLM服务
            // 目前返回一个模拟的响应
            const mockResponse: CreateMessageResult = {
                role: "assistant",
                content: [{
                    type: "text",
                    text: `This is a mock response from ${schemaName} schema. In a real implementation, this would be generated by an LLM service.`
                }],
                model: params.model?.hints?.[0] || "mock-model",
                stopReason: "endTurn"
            };

            // 发送日志消息通知
            notificationManager.sendLoggingMessageNotification(
                "info",
                `Created message response for schema: ${schemaName}`,
                "sampling"
            );

            return mockResponse;
        } catch (error) {
            logger.error("Error creating message:", error);
            throw new Error(`Failed to create message: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * 处理用户交互请求
     */
    private handleElicitation(schemaName: string, params: any): ElicitResult {
        logger.debug(`Elicitation request for schema: ${schemaName}`, {
            type: params.type,
            message: params.message,
            required: params.required
        });

        // 在实际应用中，这里应该等待用户输入
        // 目前返回一个模拟的结果
        const mockResult: ElicitResult = {
            value: params.type === "confirm" ? "true" : "User input would go here",
            confirmed: params.type === "confirm" ? true : undefined,
            cancelled: false
        };

        // 发送日志消息通知
        notificationManager.sendLoggingMessageNotification(
            "notice",
            `User interaction: ${params.message}`,
            "elicitation"
        );

        return mockResult;
    }

    /**
     * 计算运行时间
     */
    private getUptime(): string {
        const now = new Date();
        const diff = now.getTime() - this.startTime.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return [hours, minutes, seconds]
            .map(v => v.toString().padStart(2, "0"))
            .join(":");
    }
}
/**
 * 统一的MCP协议处理器
 * 为HTTP和STDIO模式提供一致的MCP方法处理逻辑
 */

import { MCPConnectionManager } from "./MCPConnectionManager";
import { notificationManager } from "./NotificationManager";
import {
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

// 动态获取版本信息
const packageVersion = require('../../package.json').version;

/**
 * MCP方法处理器类
 * 实现统一的MCP协议方法处理逻辑
 */
export class MCPMethodHandler {
    constructor(private connectionManager: MCPConnectionManager) {}

    /**
     * 统一处理MCP方法请求
     * @param schemaName Schema名称
     * @param method MCP方法名
     * @param params 方法参数
     * @param cursor 分页游标（可选）
     * @returns 方法执行结果
     */
    async handleMethod(
        schemaName: string,
        method: string,
        params?: any,
        cursor?: Cursor
    ): Promise<any> {
        switch (method) {
            case "initialize":
                return await this.handleInitialize(schemaName, params);

            case "notifications/initialized":
                return await this.handleInitializedNotification(schemaName, params);

            case "logging/setLevel":
                return await this.handleSetLevel(schemaName, params);

            case "tools/list":
                return await this.connectionManager.listTools(schemaName, cursor);

            case "tools/call":
                return await this.handleToolsCall(schemaName, params);

            case "resources/list":
                return await this.connectionManager.listResources(schemaName, cursor);

            case "resources/read":
                return await this.handleResourcesRead(schemaName, params);

            case "resources/templates/list":
                return await this.connectionManager.listResourceTemplates(schemaName, cursor);

            case "resources/subscribe":
                return await this.handleResourceSubscribe(schemaName, params);

            case "resources/unsubscribe":
                return await this.handleResourceUnsubscribe(schemaName, params);

            case "prompts/list":
                return await this.connectionManager.listPrompts(schemaName);

            case "prompts/get":
                return await this.handlePromptsGet(schemaName, params);

            case "ping":
                return await this.handlePing(schemaName, params);

            case "completion/complete":
                return await this.handleCompletion(schemaName, params);

            case "roots/list":
                return await this.handleListRoots(schemaName, params);

            case "sampling/createMessage":
                return await this.handleCreateMessage(schemaName, params);

            case "elicitation/create":
                return await this.handleElicitation(schemaName, params);

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
                    name: "mcps-proxy",
                    version: packageVersion
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
     * 处理initialized通知
     */
    private async handleInitializedNotification(schemaName: string, params: any): Promise<any> {
        logger.info(`Received initialized notification for schema: ${schemaName}`);
        // 通知没有响应，返回空结果
        return {};
    }

    /**
     * 处理logging/setLevel请求
     */
    private async handleSetLevel(schemaName: string, params: any): Promise<any> {
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
     * 处理tools/call请求
     */
    private async handleToolsCall(schemaName: string, params: any): Promise<any> {
        if (!params.name) {
            throw new Error("Tool name is required for tools/call");
        }
        return await this.connectionManager.callTool(schemaName, params);
    }

    /**
     * 处理resources/read请求
     */
    private async handleResourcesRead(schemaName: string, params: any): Promise<any> {
        if (!params.uri) {
            throw new Error("Resource URI is required for resources/read");
        }
        return await this.connectionManager.readResource(schemaName, params);
    }

    /**
     * 处理prompts/get请求
     */
    private async handlePromptsGet(schemaName: string, params: any): Promise<any> {
        if (!params.name) {
            throw new Error("Prompt name is required for prompts/get");
        }
        return await this.connectionManager.getPrompt(schemaName, params);
    }

    /**
     * 处理ping请求
     */
    private async handlePing(schemaName: string, params: any): Promise<PingResult> {
        logger.debug(`Ping request for schema: ${schemaName}`);

        // 根据MCP规范，ping方法应该返回一个简单的空对象或者不返回任何内容
        // 详细的状态信息应该通过status端点获取
        return {};
    }

    /**
     * 处理资源订阅请求
     */
    private async handleResourceSubscribe(schemaName: string, params: any): Promise<ResourceSubscribeResult> {
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
    private async handleResourceUnsubscribe(schemaName: string, params: any): Promise<ResourceSubscribeResult> {
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
    private async handleListRoots(schemaName: string, params: any): Promise<ListRootsResult> {
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
    private async handleElicitation(schemaName: string, params: any): Promise<ElicitResult> {
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
}
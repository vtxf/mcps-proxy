/**
 * MCP连接管理器
 * 管理多个MCP服务器连接和工具路由
 */

import {
    ToolListResult,
    ToolCallParams,
    ToolCallResult,
    ResourceListResult,
    ResourceReadParams,
    ResourceReadResult,
    ResourceTemplateListResult,
    PromptListResult,
    PromptGetParams,
    PromptGetResult,
    ServerStatus,
    SchemaStatus,
    Cursor,
} from "../types/MCPTypes";
import { IMCPServer } from "../interfaces/IMCPServer";
import { SchemaConfig, StdioServerConfig, HTTPServerConfig, SSEServerConfig } from "../types/ConfigTypes";
import { logger } from "../utils/Logger";
import { StdioMCPServer } from "./StdioMCPServer";
import { HTTPMCPServer } from "./HTTPMCPServer";
import { SSEMCPServer } from "./SSEMCPServer";

export class MCPConnectionManager {
    private schemas: Map<string, SchemaConnections> = new Map();

    /**
     * 添加schema和对应的MCP服务器
     */
    public async addSchema(schemaName: string, config: SchemaConfig): Promise<void> {
        if (config.enabled === false) {
            logger.info(`Schema '${schemaName}' is disabled, skipping initialization`);
            return;
        }

        logger.info(`Initializing schema '${schemaName}' with ${Object.keys(config.mcpServers).length} servers`);

        const schemaConnections = new SchemaConnections(schemaName, config);

        // 添加所有MCP服务器
        for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
            await schemaConnections.addServer(serverId, serverConfig);
        }

        // 连接所有服务器
        await schemaConnections.connectAll();

        this.schemas.set(schemaName, schemaConnections);
        logger.info(`Schema '${schemaName}' initialized successfully`);
    }

    /**
     * 移除schema
     */
    public async removeSchema(schemaName: string): Promise<void> {
        const schema = this.schemas.get(schemaName);
        if (schema) {
            await schema.disconnectAll();
            this.schemas.delete(schemaName);
            logger.info(`Schema '${schemaName}' removed`);
        }
    }

    /**
     * 检查schema是否存在且启用
     */
    public hasSchema(schemaName: string): boolean {
        return this.schemas.has(schemaName);
    }

    /**
     * 获取工具列表（合并所有服务器的工具）
     */
    public async listTools(schemaName: string, cursor?: Cursor): Promise<ToolListResult> {
        const schema = this.getSchema(schemaName);
        const allTools: any[] = [];

        for (const [serverId, server] of schema.getServers()) {
            try {
                if (server.isConnected()) {
                    const result = await server.listTools();
                    // 为每个工具添加服务器前缀
                    const prefixedTools = result.tools.map(tool => ({
                        ...tool,
                        name: `${serverId}-${tool.name}`,
                        annotations: {
                            ...tool.annotations,
                            title: tool.annotations?.title || `[${serverId}] ${tool.name}`,
                        },
                    }));
                    allTools.push(...prefixedTools);
                }
            } catch (error) {
                logger.error(`Failed to list tools from server '${serverId}':`, error);
                // 继续处理其他服务器，不让单个服务器错误影响整个请求
            }
        }

        // 简单分页实现 - 每页最多50个工具
        const pageSize = 50;
        let startIndex = 0;

        if (cursor) {
            try {
                startIndex = parseInt(atob(cursor), 10);
            } catch {
                logger.warn(`Invalid cursor provided: ${cursor}, starting from beginning`);
                startIndex = 0;
            }
        }

        const endIndex = startIndex + pageSize;
        const paginatedTools = allTools.slice(startIndex, endIndex);
        const nextCursor = endIndex < allTools.length ? btoa(endIndex.toString()) : undefined;

        return {
            tools: paginatedTools,
            nextCursor,
            _meta: {
                totalTools: allTools.length,
                currentPage: Math.floor(startIndex / pageSize) + 1,
                totalPages: Math.ceil(allTools.length / pageSize)
            }
        };
    }

    /**
     * 调用工具
     */
    public async callTool(schemaName: string, params: ToolCallParams): Promise<ToolCallResult> {
        const schema = this.getSchema(schemaName);
        const { serverId, toolName } = this.parseToolName(params.name);

        if (!serverId || !toolName) {
            return {
                content: [{
                    type: "text",
                    text: `Invalid tool name format: ${params.name}. Expected format: serverId-toolName`
                }],
                isError: true
            };
        }

        const server = schema.getServer(serverId);
        if (!server) {
            return {
                content: [{
                    type: "text",
                    text: `Server '${serverId}' not found in schema '${schemaName}'`
                }],
                isError: true
            };
        }

        if (!server.isConnected()) {
            return {
                content: [{
                    type: "text",
                    text: `Server '${serverId}' is not connected`
                }],
                isError: true
            };
        }

        try {
            // 调用原始工具名（不带前缀）
            const result = await server.callTool({
                name: toolName,
                arguments: params.arguments,
            });

            // 确保返回的结果符合MCP标准
            if (result.isError === undefined) {
                result.isError = false;
            }

            return result;
        } catch (error) {
            logger.error(`Failed to call tool '${toolName}' on server '${serverId}':`, error);
            // 按照MCP标准返回错误而不是抛出异常
            return {
                content: [{
                    type: "text",
                    text: `Tool execution error: ${error instanceof Error ? error.message : "Unknown error"}`
                }],
                isError: true
            };
        }
    }

    /**
     * 获取资源列表
     */
    public async listResources(schemaName: string, cursor?: Cursor): Promise<ResourceListResult> {
        const schema = this.getSchema(schemaName);
        const allResources: any[] = [];

        for (const [serverId, server] of schema.getServers()) {
            try {
                if (server.isConnected()) {
                    const result = await server.listResources();
                    // 为资源添加服务器信息
                    const serverResources = result.resources.map(resource => ({
                        ...resource,
                        annotations: {
                            ...resource.annotations,
                            priority: resource.annotations?.priority || 0.5,
                        },
                    }));
                    allResources.push(...serverResources);
                }
            } catch (error) {
                // 检查是否是"Method not found"错误，这通常是正常的（服务器不支持某些功能）
                if (error instanceof Error && error.message.includes('Method not found')) {
                    logger.debug(`Server '${serverId}' does not support resources/list (this is normal)`);
                } else {
                    logger.error(`Failed to list resources from server '${serverId}':`, error);
                }
                // 继续处理其他服务器
            }
        }

        // 简单分页实现 - 每页最多20个资源
        const pageSize = 20;
        let startIndex = 0;

        if (cursor) {
            try {
                startIndex = parseInt(atob(cursor), 10);
            } catch {
                logger.warn(`Invalid cursor provided: ${cursor}, starting from beginning`);
                startIndex = 0;
            }
        }

        const endIndex = startIndex + pageSize;
        const paginatedResources = allResources.slice(startIndex, endIndex);
        const nextCursor = endIndex < allResources.length ? btoa(endIndex.toString()) : undefined;

        return {
            resources: paginatedResources,
            nextCursor,
            _meta: {
                totalResources: allResources.length,
                currentPage: Math.floor(startIndex / pageSize) + 1,
                totalPages: Math.ceil(allResources.length / pageSize)
            }
        };
    }

    /**
     * 读取资源
     */
    public async readResource(schemaName: string, params: ResourceReadParams): Promise<ResourceReadResult> {
        const schema = this.getSchema(schemaName);

        // 尝试从每个服务器读取资源
        for (const [serverId, server] of schema.getServers()) {
            if (!server.isConnected()) {
                continue;
            }

            try {
                const result = await server.readResource(params);
                // 如果成功读取到内容，直接返回
                if (result.contents && result.contents.length > 0) {
                    return result;
                }
            } catch (error) {
                // 继续尝试下一个服务器
                logger.debug(`Failed to read resource from server '${serverId}':`, error);
            }
        }

        throw new Error(`Resource not found: ${params.uri}`);
    }

    /**
     * 获取提示列表
     */
    public async listPrompts(schemaName: string): Promise<PromptListResult> {
        const schema = this.getSchema(schemaName);
        const allPrompts: any[] = [];

        for (const [serverId, server] of schema.getServers()) {
            try {
                if (server.isConnected()) {
                    const result = await server.listPrompts();
                    allPrompts.push(...result.prompts);
                }
            } catch (error) {
                // 检查是否是"Method not found"错误，这通常是正常的（服务器不支持某些功能）
                if (error instanceof Error && error.message.includes('Method not found')) {
                    logger.debug(`Server '${serverId}' does not support prompts/list (this is normal)`);
                } else {
                    logger.error(`Failed to list prompts from server '${serverId}':`, error);
                }
            }
        }

        return { prompts: allPrompts };
    }

    /**
     * 获取提示内容
     */
    public async getPrompt(schemaName: string, params: PromptGetParams): Promise<PromptGetResult> {
        const schema = this.getSchema(schemaName);

        // 尝试从每个服务器获取提示
        for (const [serverId, server] of schema.getServers()) {
            if (!server.isConnected()) {
                continue;
            }

            try {
                const result = await server.getPrompt(params);
                // 如果成功获取到提示，直接返回
                if (result.messages && result.messages.length > 0) {
                    return result;
                }
            } catch (error) {
                // 继续尝试下一个服务器
                logger.debug(`Failed to get prompt from server '${serverId}':`, error);
            }
        }

        throw new Error(`Prompt not found: ${params.name}`);
    }

    /**
     * 获取资源模板列表（合并所有服务器的资源模板）
     */
    public async listResourceTemplates(schemaName: string, cursor?: Cursor): Promise<ResourceTemplateListResult> {
        const schema = this.getSchema(schemaName);
        const allTemplates: any[] = [];

        for (const [serverId, server] of schema.getServers()) {
            try {
                if (server.isConnected()) {
                    // 检查服务器是否支持资源模板功能
                    if (typeof (server as any).listResourceTemplates === 'function') {
                        const result = await (server as any).listResourceTemplates();
                        // 为每个模板添加服务器前缀
                        const prefixedTemplates = result.resourceTemplates?.map((template: any) => ({
                            ...template,
                            name: `${serverId}-${template.name}`,
                            uriTemplate: template.uriTemplate.replace(/^/, `${serverId}:`),
                            annotations: {
                                ...template.annotations,
                                title: template.annotations?.title || `[${serverId}] ${template.name}`,
                            },
                        })) || [];
                        allTemplates.push(...prefixedTemplates);
                    }
                }
            } catch (error) {
                logger.error(`Failed to list resource templates from server '${serverId}':`, error);
                // 继续处理其他服务器，不让单个服务器错误影响整个请求
            }
        }

        // 添加一些默认的资源模板
        const defaultTemplates = [
            {
                name: "file-template",
                uriTemplate: "file://{path}",
                mimeType: "text/plain",
                description: "Generic file resource template"
            },
            {
                name: "http-template",
                uriTemplate: "http://{host}/{path}",
                mimeType: "text/html",
                description: "HTTP resource template"
            },
            {
                name: "schema-template",
                uriTemplate: `schema://${schemaName}/{resource}`,
                mimeType: "application/json",
                description: `Schema-specific resource template for ${schemaName}`
            }
        ];

        allTemplates.push(...defaultTemplates);

        // 简单的分页处理
        const pageSize = 50;
        const startIndex = cursor ? parseInt(cursor) : 0;
        const endIndex = startIndex + pageSize;
        const paginatedTemplates = allTemplates.slice(startIndex, endIndex);

        return {
            resourceTemplates: paginatedTemplates,
            nextCursor: endIndex < allTemplates.length ? endIndex.toString() : undefined,
        };
    }

    /**
     * 获取schema连接
     */
    public getSchema(schemaName: string): SchemaConnections {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            throw new Error(`Schema '${schemaName}' not found or disabled`);
        }
        return schema;
    }

    /**
     * 获取schema状态
     */
    public getSchemaStatus(schemaName: string): SchemaStatus {
        const schema = this.getSchema(schemaName);
        const mcpServers: ServerStatus[] = [];
        let totalTools = 0;
        let connectedServers = 0;

        for (const [serverId, server] of schema.getServers()) {
            const status = server.getStatus();
            mcpServers.push(status);
            totalTools += status.toolCount || 0;
            if (status.status === "connected") {
                connectedServers++;
            }
        }

        return {
            status: "active",
            mcpServers,
            totalTools,
            connectedServers,
        };
    }

    /**
     * 获取所有schema状态
     */
    public getAllSchemaStatus(): Record<string, SchemaStatus> {
        const status: Record<string, SchemaStatus> = {};

        for (const [schemaName] of this.schemas) {
            status[schemaName] = this.getSchemaStatus(schemaName);
        }

        return status;
    }

    /**
     * 断开所有连接
     */
    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.schemas.values()).map(schema =>
            schema.disconnectAll()
        );

        await Promise.all(disconnectPromises);
        this.schemas.clear();
        logger.info("All schemas disconnected");
    }

    
    /**
     * 解析工具名称，提取服务器ID和工具名
     */
    private parseToolName(fullToolName: string): { serverId?: string; toolName?: string } {
        const dashIndex = fullToolName.indexOf("-");
        if (dashIndex === -1) {
            return {};
        }

        const serverId = fullToolName.substring(0, dashIndex);
        const toolName = fullToolName.substring(dashIndex + 1);

        return { serverId, toolName };
    }
}

/**
 * Schema连接管理类
 */
class SchemaConnections {
    private servers: Map<string, IMCPServer> = new Map();

    constructor(
        public readonly name: string,
        public readonly config: SchemaConfig
    ) {}

    public async addServer(serverId: string, serverConfig: any): Promise<void> {
        logger.debug(`Adding server '${serverId}' to schema '${this.name}'`);

        let server: IMCPServer;

        // 根据配置类型创建相应的MCP服务器实例
        switch (serverConfig.type) {
            case "stdio":
            case undefined: // 默认为stdio类型
                server = new StdioMCPServer(serverId, serverConfig as StdioServerConfig);
                break;

            case "http":
                server = new HTTPMCPServer(serverId, serverConfig as HTTPServerConfig);
                break;

            case "sse":
                server = new SSEMCPServer(serverId, serverConfig as SSEServerConfig);
                break;

            default:
                throw new Error(`Unsupported server type: ${serverConfig.type}`);
        }

        // 设置状态变化回调
        server.onStatusChange((status) => {
            logger.debug(`Server '${serverId}' status changed to ${status.status}`);
        });

        this.servers.set(serverId, server);
        logger.info(`Server '${serverId}' added to schema '${this.name}'`);
    }

    public async connectAll(): Promise<void> {
        const connectPromises = Array.from(this.servers.values()).map(server =>
            server.connect().catch(error => {
                logger.error(`Failed to connect server:`, error);
            })
        );

        await Promise.all(connectPromises);
    }

    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.servers.values()).map(server =>
            server.disconnect().catch(error => {
                logger.error(`Failed to disconnect server:`, error);
            })
        );

        await Promise.all(disconnectPromises);
        this.servers.clear();
    }

    public getServers(): Map<string, IMCPServer> {
        return new Map(this.servers);
    }

    public getServer(serverId: string): IMCPServer | undefined {
        return this.servers.get(serverId);
    }
}
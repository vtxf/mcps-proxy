/**
 * MCP服务器接口定义
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
    ServerStatus
} from "@/types/MCPTypes";
import { MCPServerConfig } from "@/types/ConfigTypes";

/**
 * MCP服务器基础接口
 * 定义了所有MCP服务器必须实现的方法
 */
export interface IMCPServer {
    /**
     * 服务器配置
     */
    readonly config: MCPServerConfig;

    /**
     * 服务器ID
     */
    readonly id: string;

    /**
     * 服务器状态
     */
    readonly status: ServerStatus;

    /**
     * 连接到MCP服务器
     */
    connect(): Promise<void>;

    /**
     * 断开连接
     */
    disconnect(): Promise<void>;

    /**
     * 检查连接状态
     */
    isConnected(): boolean;

    /**
     * 获取工具列表
     */
    listTools(): Promise<ToolListResult>;

    /**
     * 调用工具
     */
    callTool(params: ToolCallParams): Promise<ToolCallResult>;

    /**
     * 获取资源列表
     */
    listResources(): Promise<ResourceListResult>;

    /**
     * 读取资源
     */
    readResource(params: ResourceReadParams): Promise<ResourceReadResult>;

    /**
     * 获取资源模板列表（可选实现）
     */
    listResourceTemplates?(): Promise<ResourceTemplateListResult>;

    /**
     * 获取提示列表
     */
    listPrompts(): Promise<PromptListResult>;

    /**
     * 获取提示内容
     */
    getPrompt(params: PromptGetParams): Promise<PromptGetResult>;

    /**
     * 获取服务器状态
     */
    getStatus(): ServerStatus;

    /**
     * 设置状态更新回调
     */
    onStatusChange(callback: (status: ServerStatus) => void): void;
}
/**
 * MCP协议相关类型定义
 * 基于MCP (Model Context Protocol) 2025-06-18 规范
 */

// 进度令牌类型
export type ProgressToken = string | number;

// 分页游标类型
export type Cursor = string;

// 请求元数据
export interface RequestMeta {
    /**
     * 进度通知令牌
     */
    progressToken?: ProgressToken;
    [key: string]: unknown;
}

// JSON-RPC 2.0 基础类型
export interface JSONRPCRequest {
    jsonrpc: "2.0";
    method: string;
    params?: {
        _meta?: RequestMeta;
        [key: string]: unknown;
    };
    id: string | number;
}

export interface JSONRPCResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: JSONRPCError;
    id: string | number | null;
}

// 结果元数据
export interface ResultMeta {
    [key: string]: unknown;
}

// MCP结果基础类型
export interface Result {
    _meta?: ResultMeta;
    [key: string]: unknown;
}

export interface JSONRPCError {
    code: number;
    message: string;
    data?: any;
}

// 进度通知类型
export interface ProgressNotification {
    jsonrpc: "2.0";
    method: "notifications/progress";
    params: {
        progressToken: ProgressToken;
        progress: number;
        total?: number;
        message?: string;
    };
}

// 取消通知类型
export interface CancelledNotification {
    jsonrpc: "2.0";
    method: "notifications/cancelled";
    params: {
        requestId: string | number;
        reason?: string;
    };
}

// 分页请求类型
export interface PaginatedRequest {
    params?: {
        cursor?: Cursor;
        _meta?: RequestMeta;
        [key: string]: unknown;
    };
}

// 分页结果类型
export interface PaginatedResult extends Result {
    nextCursor?: Cursor;
}

// MCP 工具相关类型
export interface Tool {
    name: string;
    description?: string;
    inputSchema: ToolInputSchema;
    outputSchema?: ToolOutputSchema;
    annotations?: ToolAnnotations;
    _meta?: ResultMeta;
}

// 工具输出模式
export interface ToolOutputSchema {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
}

// 工具注解
export interface ToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}

export interface ToolInputSchema {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

export interface ToolCallParams {
    name: string;
    arguments?: Record<string, any>;
}

export interface ToolListResult extends PaginatedResult {
    tools: Tool[];
}

export interface ToolCallResult {
    content: any[];
    isError?: boolean;
}

// MCP 资源相关类型
export interface Resource {
    uri: string;
    name?: string;
    description?: string;
    mimeType?: string;
    annotations?: ResourceAnnotations;
    size?: number;
    _meta?: ResultMeta;
}

// 资源注解
export interface ResourceAnnotations {
    audience?: ("user" | "assistant")[];
    priority?: number;
    lastModified?: string;
}

export interface ResourceListResult extends PaginatedResult {
    resources: Resource[];
}

// 资源模板
export interface ResourceTemplate {
    name: string;
    description?: string;
    uriTemplate: string;
    mimeType?: string;
    annotations?: ResourceAnnotations;
    _meta?: ResultMeta;
}

export interface ResourceTemplateListResult extends PaginatedResult {
    resourceTemplates: ResourceTemplate[];
}

export interface ResourceReadParams {
    uri: string;
}

export interface ResourceReadResult {
    contents: any[];
}

// MCP 提示相关类型
export interface Prompt {
    name: string;
    description?: string;
    arguments?: PromptArgument[];
    _meta?: ResultMeta;
}

export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}

export interface PromptListResult extends PaginatedResult {
    prompts: Prompt[];
}

// 提示消息内容类型
export interface TextContent {
    type: "text";
    text: string;
    annotations?: ResourceAnnotations;
    _meta?: ResultMeta;
}

export interface ImageContent {
    type: "image";
    data: string; // base64编码
    mimeType: string;
    annotations?: ResourceAnnotations;
    _meta?: ResultMeta;
}

export interface EmbeddedResource {
    type: "resource";
    resource: {
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
    annotations?: ResourceAnnotations;
    _meta?: ResultMeta;
}

export type ContentBlock = TextContent | ImageContent | EmbeddedResource;

export interface PromptGetParams {
    name: string;
    arguments?: Record<string, any>;
}

export interface PromptGetResult {
    description?: string;
    messages: PromptMessage[];
}

export interface PromptMessage {
    role: "user" | "assistant" | "system";
    content: any;
}

// MCP 服务器连接状态
export interface ServerStatus {
    id: string;
    name?: string;
    status: "connected" | "disconnected" | "error";
    type: "stdio" | "http" | "sse";
    toolCount?: number;
    error?: string;
    lastConnected?: Date;
    lastError?: Date;
}

// Schema 状态
export interface SchemaStatus {
    status: "active" | "disabled" | "error";
    mcpServers: ServerStatus[];
    totalTools: number;
    connectedServers: number;
}

// API 状态信息
export interface APIStatus {
    server: {
        status: "running" | "stopped" | "error";
        port: number;
        url: string;
        uptime: string;
    };
    schemas: Record<string, SchemaStatus>;
    summary: {
        totalSchemas: number;
        activeSchemas: number;
        totalServers: number;
        connectedServers: number;
        failedServers: number;
        totalTools: number;
    };
}

// MCP 消息类型
export type MCPMessage = JSONRPCRequest | JSONRPCResponse;

// 资源订阅相关类型
export interface ResourceSubscribeParams {
    uri: string;
}

export interface ResourceUnsubscribeParams {
    uri: string;
}

export interface ResourceSubscribeResult {
    success: boolean;
    message?: string;
}

export interface ResourceUpdatedNotification {
    jsonrpc: "2.0";
    method: "notifications/resources/updated";
    params: {
        uri: string;
        contents?: ContentBlock[];
    };
}

// 日志消息通知类型
export interface LoggingMessageNotification {
    jsonrpc: "2.0";
    method: "notifications/message";
    params: {
        level: "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";
        logger?: string;
        data: any;
    };
}

// 自动补全相关类型
export interface PromptReference {
    type: "ref/prompt";
    name: string;
}

export interface ResourceTemplateReference {
    type: "ref/resource";
    uriTemplate: string;
}

export interface CompletionParams {
    ref: PromptReference | ResourceTemplateReference;
    argument?: {
        name: string;
        value?: any;
    };
}

export interface CompletionResult {
    values: CompletionValue[];
    total?: number;
}

export interface CompletionValue {
    value: any;
    description?: string;
}

// 根目录相关类型
export interface Root {
    uri: string;
    name?: string;
}

export interface ListRootsResult {
    roots: Root[];
}

export interface ResourceListChangedNotification {
    jsonrpc: "2.0";
    method: "notifications/resources/list_changed";
}

export interface ToolListChangedNotification {
    jsonrpc: "2.0";
    method: "notifications/tools/list_changed";
}

export interface PromptListChangedNotification {
    jsonrpc: "2.0";
    method: "notifications/prompts/list_changed";
}

export interface RootsListChangedNotification {
    jsonrpc: "2.0";
    method: "notifications/roots/list_changed";
}

// 采样相关类型
export interface SamplingMessage {
    role: "user" | "assistant" | "system";
    content: ContentBlock | ContentBlock[];
}

export interface CreateMessageParams {
    messages: SamplingMessage[];
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    model?: {
        hints?: string[];
    };
    includeContext?: boolean;
}

export interface CreateMessageResult {
    role: "assistant";
    content: ContentBlock[];
    model: string;
    stopReason?: "endTurn" | "stopSequence" | "maxTokens" | "unknown";
}

// 用户交互相关类型
export interface ElicitParams {
    message: string;
    type?: "input" | "confirm" | "select";
    options?: string[];
    required?: boolean;
}

export interface ElicitResult {
    value?: string;
    confirmed?: boolean;
    cancelled?: boolean;
}

// Ping响应类型
export interface PingResult {
    timestamp?: string;
    schema?: string;
    status?: string;
    connectedServers?: number;
    totalServers?: number;
    totalTools?: number;
    uptime?: string;
}

// MCP 方法名称
export const MCP_METHODS = {
    INITIALIZE: "initialize",
    NOTIFICATION_INITIALIZED: "notifications/initialized",
    NOTIFICATION_CANCELLED: "notifications/cancelled",
    NOTIFICATION_PROGRESS: "notifications/progress",
    LOGGING_SET_LEVEL: "logging/setLevel",
    LOGGING_MESSAGE: "notifications/message",
    TOOLS_LIST: "tools/list",
    TOOLS_CALL: "tools/call",
    NOTIFICATION_TOOLS_LIST_CHANGED: "notifications/tools/list_changed",
    RESOURCES_LIST: "resources/list",
    RESOURCES_READ: "resources/read",
    RESOURCES_TEMPLATES_LIST: "resources/templates/list",
    RESOURCES_SUBSCRIBE: "resources/subscribe",
    RESOURCES_UNSUBSCRIBE: "resources/unsubscribe",
    NOTIFICATION_RESOURCES_LIST_CHANGED: "notifications/resources/list_changed",
    NOTIFICATION_RESOURCES_UPDATED: "notifications/resources/updated",
    PROMPTS_LIST: "prompts/list",
    PROMPTS_GET: "prompts/get",
    NOTIFICATION_PROMPTS_LIST_CHANGED: "notifications/prompts/list_changed",
    PING: "ping",
    COMPLETION_COMPLETE: "completion/complete",
    ROOTS_LIST: "roots/list",
    NOTIFICATION_ROOTS_LIST_CHANGED: "notifications/roots/list_changed",
    SAMPLING_CREATE_MESSAGE: "sampling/createMessage",
    ELICITATION_CREATE: "elicitation/create",
} as const;

export type MCPMethod = typeof MCP_METHODS[keyof typeof MCP_METHODS];
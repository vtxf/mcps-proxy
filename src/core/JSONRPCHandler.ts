/**
 * JSON-RPC 2.0 消息处理器
 * 处理JSON-RPC请求和响应的序列化/反序列化
 */

import {
    JSONRPCRequest,
    JSONRPCResponse,
    JSONRPCError,
    ProgressNotification,
    CancelledNotification,
    MCP_METHODS,
    MCPMethod,
    ProgressToken,
    RequestMeta
} from "../types/MCPTypes";
import { logger } from "../utils/Logger";

export class JSONRPCHandler {
    /**
     * 解析JSON-RPC请求
     */
    public parseRequest(data: string): JSONRPCRequest | null {
        try {
            const request = JSON.parse(data);

            // 验证基础结构
            if (!this.validateRequest(request)) {
                return null;
            }

            return request as JSONRPCRequest;
        } catch (error) {
            logger.error("Failed to parse JSON-RPC request:", error);
            return null;
        }
    }

    /**
     * 创建JSON-RPC响应
     */
    public createResponse(id: string | number | null, result?: any, error?: JSONRPCError): JSONRPCResponse {
        const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
        };

        if (error) {
            response.error = error;
        } else {
            response.result = result;
        }

        return response;
    }

    /**
     * 创建错误响应
     */
    public createErrorResponse(id: string | number, code: number, message: string, data?: any): JSONRPCResponse {
        const error: JSONRPCError = {
            code,
            message,
            data,
        };

        return this.createResponse(id, undefined, error);
    }

    /**
     * 创建解析错误响应
     */
    public createParseErrorResponse(): JSONRPCResponse {
        return this.createResponse(null, undefined, {
            code: -32700,
            message: "Parse error",
        });
    }

    /**
     * 创建无效请求错误响应
     */
    public createInvalidRequestResponse(id: string | number | null): JSONRPCResponse {
        return this.createResponse(id || null, undefined, {
            code: -32600,
            message: "Invalid Request",
        });
    }

    /**
     * 创建方法未找到错误响应
     */
    public createMethodNotFoundResponse(id: string | number): JSONRPCResponse {
        return this.createResponse(id, undefined, {
            code: -32601,
            message: "Method not found",
        });
    }

    /**
     * 创建无效参数错误响应
     */
    public createInvalidParamsResponse(id: string | number, data?: any): JSONRPCResponse {
        return this.createResponse(id, undefined, {
            code: -32602,
            message: "Invalid params",
            data,
        });
    }

    /**
     * 创建内部错误响应
     */
    public createInternalErrorResponse(id: string | number | null, data?: any): JSONRPCResponse {
        return this.createResponse(id, undefined, {
            code: -32603,
            message: "Internal error",
            data,
        });
    }

    /**
     * 序列化响应为字符串
     */
    public serializeResponse(response: JSONRPCResponse): string {
        try {
            return JSON.stringify(response);
        } catch (error) {
            logger.error("Failed to serialize JSON-RPC response:", error);
            return JSON.stringify(this.createInternalErrorResponse(
                response.id,
                "Response serialization failed"
            ));
        }
    }

    /**
     * 验证JSON-RPC请求格式
     */
    private validateRequest(request: any): boolean {
        // 检查必需字段
        if (!request || typeof request !== "object") {
            logger.error("Request must be an object");
            return false;
        }

        // 检查jsonrpc版本
        if (request.jsonrpc !== "2.0") {
            logger.error("Invalid jsonrpc version:", request.jsonrpc);
            return false;
        }

        // 检查method字段
        if (!request.method || typeof request.method !== "string") {
            logger.error("Method is required and must be a string");
            return false;
        }

        // JSON-RPC 2.0中，通知可以没有id字段
        // 如果有id字段，则这是一个请求，否则是通知
        // 这里我们不强制要求id字段，支持通知消息

        // 验证method是否为MCP方法
        if (!this.isValidMCPMethod(request.method)) {
            logger.error("Unsupported MCP method:", request.method);
            return false;
        }

        return true;
    }

    /**
     * 检查是否为有效的MCP方法
     */
    private isValidMCPMethod(method: string): method is MCPMethod {
        return Object.values(MCP_METHODS).includes(method as MCPMethod);
    }

    /**
     * 检查请求是否为批处理请求
     */
    public isBatchRequest(data: string): boolean {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed);
        } catch {
            return false;
        }
    }

    /**
     * 处理批处理请求
     */
    public parseBatchRequest(data: string): JSONRPCRequest[] {
        try {
            const requests = JSON.parse(data);

            if (!Array.isArray(requests)) {
                return [];
            }

            return requests
                .map(request => this.parseRequest(JSON.stringify(request)))
                .filter((request): request is JSONRPCRequest => request !== null);
        } catch (error) {
            logger.error("Failed to parse batch request:", error);
            return [];
        }
    }

    /**
     * 创建批处理响应
     */
    public createBatchResponse(responses: JSONRPCResponse[]): string {
        try {
            return JSON.stringify(responses);
        } catch (error) {
            logger.error("Failed to serialize batch response:", error);
            return JSON.stringify([this.createInternalErrorResponse(
                null,
                "Batch response serialization failed"
            )]);
        }
    }

    /**
     * 创建进度通知
     */
    public createProgressNotification(
        progressToken: ProgressToken,
        progress: number,
        total?: number,
        message?: string
    ): ProgressNotification {
        return {
            jsonrpc: "2.0",
            method: "notifications/progress",
            params: {
                progressToken,
                progress,
                total,
                message
            }
        };
    }

    /**
     * 创建取消通知
     */
    public createCancelledNotification(
        requestId: string | number,
        reason?: string
    ): CancelledNotification {
        return {
            jsonrpc: "2.0",
            method: "notifications/cancelled",
            params: {
                requestId,
                reason
            }
        };
    }

    /**
     * 序列化进度通知为字符串
     */
    public serializeProgressNotification(notification: ProgressNotification): string {
        try {
            return JSON.stringify(notification);
        } catch (error) {
            logger.error("Failed to serialize progress notification:", error);
            throw new Error("Progress notification serialization failed");
        }
    }

    /**
     * 序列化取消通知为字符串
     */
    public serializeCancelledNotification(notification: CancelledNotification): string {
        try {
            return JSON.stringify(notification);
        } catch (error) {
            logger.error("Failed to serialize cancelled notification:", error);
            throw new Error("Cancelled notification serialization failed");
        }
    }

    /**
     * 从请求中提取元数据
     */
    public extractRequestMeta(request: JSONRPCRequest): RequestMeta | undefined {
        return request.params?._meta;
    }

    /**
     * 从请求中提取进度令牌
     */
    public extractProgressToken(request: JSONRPCRequest): ProgressToken | undefined {
        return request.params?._meta?.progressToken;
    }

    /**
     * 创建带有元数据的响应
     */
    public createResponseWithMeta(
        id: string | number | null,
        result?: any,
        error?: JSONRPCError,
        meta?: { [key: string]: unknown }
    ): JSONRPCResponse {
        const response: JSONRPCResponse = {
            jsonrpc: "2.0",
            id,
        };

        if (error) {
            response.error = error;
        } else {
            // 如果有元数据，添加到结果中
            if (meta) {
                response.result = {
                    ...result,
                    _meta: meta
                };
            } else {
                response.result = result;
            }
        }

        return response;
    }
}
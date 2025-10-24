/**
 * HTTP路由器
 * 处理HTTP请求并路由到相应的MCP处理器
 */

import { Request, Response, NextFunction } from "express";
import { IHTTPRouter } from "../interfaces/IHTTPRouter";
import { JSONRPCHandler } from "./JSONRPCHandler";
import { MCPConnectionManager } from "./MCPConnectionManager";
import { MCPMethodHandler } from "./MCPMethodHandler";
import {
    APIStatus,
    ProgressToken,
    Cursor
} from "../types/MCPTypes";
import { logger } from "../utils/Logger";

export class HTTPRouter implements IHTTPRouter {
    private jsonRpcHandler: JSONRPCHandler;
    private methodHandler: MCPMethodHandler;
    private progressCallbacks: Map<ProgressToken, (response: Response) => void> = new Map();

    constructor(
        private connectionManager: MCPConnectionManager,
        private startTime: Date = new Date()
    ) {
        this.jsonRpcHandler = new JSONRPCHandler();
        this.methodHandler = new MCPMethodHandler(connectionManager);
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
        return await this.methodHandler.handleMethod(schemaName, method, params, cursor);
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
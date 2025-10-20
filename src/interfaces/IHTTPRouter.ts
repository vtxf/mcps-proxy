/**
 * HTTP路由接口定义
 */

import { Request, Response, NextFunction } from "express";
import { JSONRPCRequest, JSONRPCResponse } from "@/types/MCPTypes";

/**
 * HTTP路由接口
 * 定义了处理HTTP请求的方法
 */
export interface IHTTPRouter {
    /**
     * 处理MCP协议请求
     */
    handleMCPRequest(req: Request, res: Response, next: NextFunction): Promise<void>;

    /**
     * 处理状态查询请求
     */
    handleStatusRequest(req: Request, res: Response, next: NextFunction): Promise<void>;

    /**
     * 设置路由
     */
    setupRoutes(): void;
}
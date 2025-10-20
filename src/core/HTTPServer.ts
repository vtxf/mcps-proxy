/**
 * HTTP服务器
 * 基于Express.js的HTTP API服务器
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { HTTPRouter } from "./HTTPRouter";
import { MCPConnectionManager } from "./MCPConnectionManager";
import { ServerConfig } from "../types/ConfigTypes";
import { logger } from "../utils/Logger";

export class HTTPServer {
    private app: Express;
    private router: HTTPRouter;
    private server?: any;

    constructor(
        private connectionManager: MCPConnectionManager,
        private config: ServerConfig
    ) {
        this.app = express();
        this.router = new HTTPRouter(connectionManager);
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * 启动HTTP服务器
     */
    public async start(port?: number): Promise<void> {
        const actualPort = port || this.config.port || 3095;

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(actualPort, this.config.host || "127.0.0.1", () => {
                    const address = this.server?.address();
                    const host = address && typeof address === "object" ? address.address : "localhost";
                    const port = address && typeof address === "object" ? address.port : actualPort;

                    logger.info(`HTTP server started successfully`);
                    logger.info(`Server URL: http://${host}:${port}`);
                    logger.info(`API endpoint: http://${host}:${port}/api/{schema}/mcp`);
                    logger.info(`Status endpoint: http://${host}:${port}/api/status`);

                    resolve();
                });

                this.server.on("error", (error: any) => {
                    logger.error("HTTP server error:", error);
                    reject(error);
                });

            } catch (error) {
                logger.error("Failed to start HTTP server:", error);
                reject(error);
            }
        });
    }

    /**
     * 停止HTTP服务器
     */
    public async stop(): Promise<void> {
        if (this.server) {
            return new Promise((resolve, reject) => {
                this.server.close((error?: any) => {
                    if (error) {
                        logger.error("Error stopping HTTP server:", error);
                        reject(error);
                    } else {
                        logger.info("HTTP server stopped");
                        resolve();
                    }
                });
            });
        }
    }

    /**
     * 获取Express应用实例
     */
    public getApp(): Express {
        return this.app;
    }

    /**
     * 设置中间件
     */
    private setupMiddleware(): void {
        // JSON解析中间件
        this.app.use(express.json({ limit: "10mb" }));

        // 设置CORS
        this.setupCORS();

        // 请求日志中间件
        this.app.use(this.requestLogger.bind(this));

        // 错误处理中间件
        this.app.use(this.errorHandler.bind(this));
    }

    /**
     * 设置CORS
     */
    private setupCORS(): void {
        if (this.config.cors?.enabled !== false) {
            const corsOptions: cors.CorsOptions = {
                origin: this.config.cors?.origins || "*",
                methods: this.config.cors?.methods || ["GET", "POST", "OPTIONS"],
                credentials: this.config.cors?.credentials || false,
                allowedHeaders: this.config.cors?.allowedHeaders || ["Content-Type", "Authorization"],
            };

            this.app.use(cors(corsOptions));
        }
    }

    /**
     * 设置路由
     */
    private setupRoutes(): void {
        // 健康检查端点
        this.app.get("/health", (req: Request, res: Response) => {
            res.json({
                status: "ok",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        });

        // API状态端点
        this.app.get("/api/status", this.router.handleStatusRequest.bind(this.router));

        // MCP协议端点
        this.app.post("/api/:schema/mcp", this.router.handleMCPRequest.bind(this.router));

        // CORS预检请求
        this.app.options("/api/:schema/mcp", this.router.handleOptionsRequest.bind(this.router));

        // 404处理
        this.app.use("*", (req: Request, res: Response) => {
            res.status(404).json({
                error: "Not Found",
                message: `Endpoint ${req.method} ${req.originalUrl} not found`,
                availableEndpoints: [
                    "GET /health",
                    "GET /api/status",
                    "POST /api/{schema}/mcp",
                ],
            });
        });
    }

    /**
     * 请求日志中间件
     */
    private requestLogger(req: Request, res: Response, next: NextFunction): void {
        const start = Date.now();
        const { method, url, ip } = req;
        const userAgent = req.get("User-Agent") || "Unknown";

        // 记录请求开始
        logger.debug(`${method} ${url}`, {
            ip,
            userAgent,
        });

        // 监听响应结束
        res.on("finish", () => {
            const duration = Date.now() - start;
            const { statusCode } = res;

            logger.debug(`${method} ${url} - ${statusCode} (${duration}ms)`, {
                ip,
                userAgent,
                duration,
                statusCode,
            });
        });

        next();
    }

    /**
     * 错误处理中间件
     */
    private errorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
        logger.error("Unhandled error:", error);

        // 如果响应已经发送，交给默认错误处理器
        if (res.headersSent) {
            next(error);
            return;
        }

        // 根据错误类型返回适当的响应
        if (error.type === "entity.parse.failed") {
            // JSON解析错误
            res.status(400).json({
                error: "Bad Request",
                message: "Invalid JSON in request body",
            });
            return;
        }

        if (error.type === "entity.too.large") {
            // 请求体过大
            res.status(413).json({
                error: "Payload Too Large",
                message: "Request body too large",
            });
            return;
        }

        // 默认内部服务器错误
        res.status(500).json({
            error: "Internal Server Error",
            message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
        });
    }
}
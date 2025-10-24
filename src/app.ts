/**
 * 主应用程序
 * 整合所有组件，提供完整的MCP代理服务
 */

import { HTTPApplication } from "./HTTPApplication";
import { STDIOApplication } from "./STDIOApplication";
import { Config } from "./types/ConfigTypes";

/**
 * @deprecated 请使用 HTTPApplication 或 STDIOApplication
 * 这个类仅作为向后兼容的接口保留
 */
export class Application {
    private httpApplication?: HTTPApplication;
    private stdioApplication?: STDIOApplication;
    private mode: "http" | "stdio";

    constructor(config: Config, mode: "http" | "stdio") {
        this.mode = mode;

        if (mode === "http") {
            this.httpApplication = new HTTPApplication(config);
        } else {
            throw new Error("Application constructor for STDIO mode requires schema parameter. Use STDIOApplication directly.");
        }
    }

    public async start(schemaName?: string): Promise<void> {
        if (this.mode === "http") {
            await this.httpApplication!.start();
        } else {
            throw new Error("STDIO mode not supported in deprecated Application class. Use STDIOApplication instead.");
        }
    }

    public async stop(): Promise<void> {
        if (this.mode === "http" && this.httpApplication) {
            await this.httpApplication.stop();
        }
    }

    public async reloadConfig(): Promise<void> {
        if (this.mode === "http" && this.httpApplication) {
            await this.httpApplication.reloadConfig();
        }
    }

    public getStatus(): any {
        if (this.mode === "http" && this.httpApplication) {
            return this.httpApplication.getStatus();
        }
        return {
            status: "stopped",
            message: "Application is not running",
        };
    }

    public isApplicationRunning(): boolean {
        if (this.mode === "http" && this.httpApplication) {
            return this.httpApplication.isApplicationRunning();
        }
        return false;
    }
}
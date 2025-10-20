/**
 * 简单的日志工具
 * 使用Node.js内置的console和fs模块，不依赖第三方库
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
}

export class Logger {
    private static instance: Logger;
    private logLevel: LogLevel = LogLevel.INFO;
    private logFile?: string;
    private consoleEnabled: boolean = true;

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * 配置日志器
     */
    public configure(options: {
        level?: string;
        file?: string;
        console?: boolean;
    }): void {
        if (options.level) {
            this.logLevel = this.parseLogLevel(options.level);
        }

        if (options.file) {
            this.logFile = this.expandPath(options.file);
            this.ensureLogDirectory();
        }

        this.consoleEnabled = options.console !== false;
    }

    /**
     * 错误日志
     */
    public error(message: string, data?: any): void {
        this.log(LogLevel.ERROR, message, data);
    }

    /**
     * 警告日志
     */
    public warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, message, data);
    }

    /**
     * 信息日志
     */
    public info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    /**
     * 调试日志
     */
    public debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * 设置日志级别
     */
    public setLevel(level: string): void {
        this.logLevel = this.parseLogLevel(level);
        logger.info(`Log level set to: ${level}`);
    }

    /**
     * 核心日志方法
     */
    private log(level: LogLevel, message: string, data?: any): void {
        if (level > this.logLevel) {
            return;
        }

        const logEntry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: this.getLevelName(level),
            message,
            data,
        };

        // 输出到控制台
        if (this.consoleEnabled) {
            this.logToConsole(logEntry);
        }

        // 写入文件
        if (this.logFile) {
            this.logToFile(logEntry);
        }
    }

    /**
     * 输出到控制台
     */
    private logToConsole(entry: LogEntry): void {
        const timestamp = entry.timestamp.replace("T", " ").substring(0, 19);
        const prefix = `[${timestamp}] [${entry.level}]`;

        switch (entry.level) {
            case "ERROR":
                console.error(`\x1b[31m${prefix}\x1b[0m`, entry.message);
                if (entry.data) {
                    console.error("\x1b[31mData:\x1b[0m", entry.data);
                }
                break;
            case "WARN":
                console.warn(`\x1b[33m${prefix}\x1b[0m`, entry.message);
                if (entry.data) {
                    console.warn("\x1b[33mData:\x1b[0m", entry.data);
                }
                break;
            case "INFO":
                console.info(`\x1b[36m${prefix}\x1b[0m`, entry.message);
                if (entry.data) {
                    console.info("\x1b[36mData:\x1b[0m", entry.data);
                }
                break;
            case "DEBUG":
                console.debug(`\x1b[37m${prefix}\x1b[0m`, entry.message);
                if (entry.data) {
                    console.debug("\x1b[37mData:\x1b[0m", entry.data);
                }
                break;
        }
    }

    /**
     * 写入日志文件
     */
    private logToFile(entry: LogEntry): void {
        try {
            const logLine = JSON.stringify(entry) + "\n";
            appendFileSync(this.logFile!, logLine, "utf8");
        } catch (error) {
            console.error("Failed to write to log file:", error);
        }
    }

    /**
     * 解析日志级别
     */
    private parseLogLevel(level: string): LogLevel {
        switch (level.toLowerCase()) {
            case "error":
                return LogLevel.ERROR;
            case "warn":
                return LogLevel.WARN;
            case "info":
                return LogLevel.INFO;
            case "debug":
                return LogLevel.DEBUG;
            default:
                return LogLevel.INFO;
        }
    }

    /**
     * 获取级别名称
     */
    private getLevelName(level: LogLevel): string {
        switch (level) {
            case LogLevel.ERROR:
                return "ERROR";
            case LogLevel.WARN:
                return "WARN";
            case LogLevel.INFO:
                return "INFO";
            case LogLevel.DEBUG:
                return "DEBUG";
            default:
                return "UNKNOWN";
        }
    }

    /**
     * 展开路径中的~符号
     */
    private expandPath(path: string): string {
        if (path.startsWith("~/")) {
            const homeDir = process.env.HOME || process.env.USERPROFILE || "";
            return path.replace("~", homeDir);
        }
        return path;
    }

    /**
     * 确保日志目录存在
     */
    private ensureLogDirectory(): void {
        if (!this.logFile) return;

        const dir = dirname(this.logFile);
        if (!existsSync(dir)) {
            try {
                mkdirSync(dir, { recursive: true });
            } catch (error) {
                console.error("Failed to create log directory:", error);
            }
        }
    }
}

// 导出单例实例
export const logger = Logger.getInstance();
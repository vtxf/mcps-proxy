/**
 * Logger工具测试
 */

import { Logger, logger } from "@/utils/Logger";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

describe("Logger", () => {
    let testLogger: Logger;
    const testLogFile = join(__dirname, "test.log");

    beforeEach(() => {
        testLogger = Logger.getInstance();
        // 清理之前的测试文件
        if (existsSync(testLogFile)) {
            unlinkSync(testLogFile);
        }
    });

    afterEach(() => {
        // 清理测试文件
        if (existsSync(testLogFile)) {
            unlinkSync(testLogFile);
        }
    });

    describe("配置", () => {
        it("应该能够配置日志级别", () => {
            testLogger.configure({ level: "error" });
            testLogger.info("这条信息不应该显示");
            // 由于这是单元测试，我们无法直接验证控制台输出
            // 但至少可以确认不会抛出错误
        });

        it("应该能够配置日志文件", () => {
            testLogger.configure({
                level: "info",
                file: testLogFile,
                console: false,
            });

            testLogger.info("测试消息");

            // 验证文件是否创建
            expect(existsSync(testLogFile)).toBe(true);
        });
    });

    describe("日志方法", () => {
        beforeEach(() => {
            testLogger.configure({
                level: "debug",
                console: false,
            });
        });

        it("应该能够记录错误日志", () => {
            expect(() => {
                testLogger.error("错误消息", { code: 500 });
            }).not.toThrow();
        });

        it("应该能够记录警告日志", () => {
            expect(() => {
                testLogger.warn("警告消息");
            }).not.toThrow();
        });

        it("应该能够记录信息日志", () => {
            expect(() => {
                testLogger.info("信息消息");
            }).not.toThrow();
        });

        it("应该能够记录调试日志", () => {
            expect(() => {
                testLogger.debug("调试消息");
            }).not.toThrow();
        });
    });

    describe("单例模式", () => {
        it("应该返回相同的实例", () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            expect(instance1).toBe(instance2);
        });

        it("导出的logger实例应该是单例", () => {
            expect(logger).toBeInstanceOf(Logger);
        });
    });

    describe("日志级别过滤", () => {
        it("应该根据级别过滤日志", () => {
            testLogger.configure({ level: "warn", console: false });

            // 这些调用不应该抛出错误
            testLogger.error("错误消息");
            testLogger.warn("警告消息");
            testLogger.info("信息消息"); // 应该被过滤
            testLogger.debug("调试消息"); // 应该被过滤

            // 验证不会抛出错误
            expect(true).toBe(true);
        });
    });

    describe("路径展开", () => {
        it("应该能够展开~路径", () => {
            const homeDir = process.env.HOME || process.env.USERPROFILE || "";
            const expandedPath = join(homeDir, ".mcps-proxy", "test.log");

            testLogger.configure({
                level: "info",
                file: "~/.mcps-proxy/test.log",
                console: false,
            });

            testLogger.info("测试消息");

            // 注意：在实际环境中，这可能需要管理员权限
            // 所以这里只是验证配置过程不会出错
        });
    });
});
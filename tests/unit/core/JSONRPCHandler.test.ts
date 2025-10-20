/**
 * JSONRPCHandler测试
 */

import { JSONRPCHandler } from "@/core/JSONRPCHandler";

describe("JSONRPCHandler", () => {
    let handler: JSONRPCHandler;

    beforeEach(() => {
        handler = new JSONRPCHandler();
    });

    describe("请求解析", () => {
        it("应该能够解析有效的JSON-RPC请求", () => {
            const validRequest = {
                jsonrpc: "2.0",
                method: "tools/list",
                params: {},
                id: 1,
            };

            const request = handler.parseRequest(JSON.stringify(validRequest));

            expect(request).toEqual(validRequest);
        });

        it("应该拒绝无效的JSON", () => {
            const result = handler.parseRequest("invalid json");
            expect(result).toBeNull();
        });

        it("应该拒绝缺少必需字段的请求", () => {
            const invalidRequests = [
                { method: "test", id: 1 }, // 缺少jsonrpc
                { jsonrpc: "2.0", id: 1 }, // 缺少method
                { jsonrpc: "2.0", method: "test" }, // 缺少id
                { jsonrpc: "1.0", method: "test", id: 1 }, // 错误的jsonrpc版本
            ];

            invalidRequests.forEach(invalidRequest => {
                const result = handler.parseRequest(JSON.stringify(invalidRequest));
                expect(result).toBeNull();
            });
        });

        it("应该验证MCP方法", () => {
            const validRequest = {
                jsonrpc: "2.0",
                method: "tools/list",
                params: {},
                id: 1,
            };

            const invalidRequest = {
                jsonrpc: "2.0",
                method: "invalid/method",
                params: {},
                id: 1,
            };

            expect(handler.parseRequest(JSON.stringify(validRequest))).toBeTruthy();
            expect(handler.parseRequest(JSON.stringify(invalidRequest))).toBeNull();
        });
    });

    describe("响应创建", () => {
        it("应该能够创建成功响应", () => {
            const result = { tools: [] };
            const response = handler.createResponse(1, result);

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                result,
            });
        });

        it("应该能够创建错误响应", () => {
            const error = {
                code: -32602,
                message: "Invalid params",
            };
            const response = handler.createResponse(1, undefined, error);

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                error,
            });
        });
    });

    describe("标准错误响应", () => {
        it("应该创建解析错误响应", () => {
            const response = handler.createParseErrorResponse();

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32700,
                    message: "Parse error",
                },
            });
        });

        it("应该创建无效请求响应", () => {
            const response = handler.createInvalidRequestResponse(1);

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                error: {
                    code: -32600,
                    message: "Invalid Request",
                },
            });
        });

        it("应该创建方法未找到响应", () => {
            const response = handler.createMethodNotFoundResponse(1);

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                error: {
                    code: -32601,
                    message: "Method not found",
                },
            });
        });

        it("应该创建无效参数响应", () => {
            const response = handler.createInvalidParamsResponse(1, { field: "test" });

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                error: {
                    code: -32602,
                    message: "Invalid params",
                    data: { field: "test" },
                },
            });
        });

        it("应该创建内部错误响应", () => {
            const response = handler.createInternalErrorResponse(1, "Server error");

            expect(response).toEqual({
                jsonrpc: "2.0",
                id: 1,
                error: {
                    code: -32603,
                    message: "Internal error",
                    data: "Server error",
                },
            });
        });
    });

    describe("响应序列化", () => {
        it("应该能够序列化响应", () => {
            const response = {
                jsonrpc: "2.0" as const,
                id: 1,
                result: { tools: [] },
            };

            const serialized = handler.serializeResponse(response);
            const parsed = JSON.parse(serialized);

            expect(parsed).toEqual(response);
        });

        it("应该处理序列化错误", () => {
            // 创建一个循环引用对象
            const circular: any = { a: 1 };
            circular.self = circular;

            const response = {
                jsonrpc: "2.0" as const,
                id: 1,
                result: circular,
            };

            const serialized = handler.serializeResponse(response);
            const parsed = JSON.parse(serialized);

            // 应该返回内部错误响应
            expect(parsed.error).toBeDefined();
            expect(parsed.error.code).toBe(-32603);
        });
    });

    describe("批处理请求", () => {
        it("应该识别批处理请求", () => {
            const batchRequest = [
                { jsonrpc: "2.0", method: "tools/list", id: 1 },
                { jsonrpc: "2.0", method: "tools/call", id: 2 },
            ];

            expect(handler.isBatchRequest(JSON.stringify(batchRequest))).toBe(true);
            expect(handler.isBatchRequest(JSON.stringify({ jsonrpc: "2.0", method: "test", id: 1 }))).toBe(false);
        });

        it("应该解析批处理请求", () => {
            const batchRequest = [
                { jsonrpc: "2.0", method: "tools/list", id: 1 },
                { jsonrpc: "2.0", method: "tools/call", id: 2 },
            ];

            const requests = handler.parseBatchRequest(JSON.stringify(batchRequest));

            expect(requests).toHaveLength(2);
            expect(requests[0].method).toBe("tools/list");
            expect(requests[1].method).toBe("tools/call");
        });

        it("应该过滤批处理中的无效请求", () => {
            const batchRequest = [
                { jsonrpc: "2.0", method: "tools/list", id: 1 },
                { invalid: "request" }, // 无效请求
                { jsonrpc: "2.0", method: "tools/call", id: 2 },
            ];

            const requests = handler.parseBatchRequest(JSON.stringify(batchRequest));

            expect(requests).toHaveLength(2); // 只有有效请求被解析
        });

        it("应该创建批处理响应", () => {
            const responses = [
                { jsonrpc: "2.0" as const, id: 1, result: { tools: [] } },
                { jsonrpc: "2.0" as const, id: 2, result: { content: "result" } },
            ];

            const serialized = handler.createBatchResponse(responses);
            const parsed = JSON.parse(serialized);

            expect(parsed).toEqual(responses);
        });
    });
});
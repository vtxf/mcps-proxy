/**
 * Jest测试环境设置
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 全局测试设置
beforeAll(() => {
    // 设置测试环境变量
    process.env.NODE_ENV = "test";
});

afterAll(() => {
    // 清理测试环境
    delete process.env.NODE_ENV;
});
#!/usr/bin/env node

const http = require('http');
const { performance } = require('perf_hooks');

class HTTPModeTester {
    constructor(baseUrl = 'http://localhost:9999') {
        this.baseUrl = baseUrl;
        this.requestId = 0;
    }

    async sendRequest(method, params = {}, schema = 'default') {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: "2.0",
                method: method,
                params: params,
                id: ++this.requestId
            };

            const postData = JSON.stringify(request);
            const options = {
                hostname: 'localhost',
                port: 9999,
                path: `/api/${schema}/mcp`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const startTime = performance.now();
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const endTime = performance.now();
                    try {
                        const response = JSON.parse(data);
                        resolve({
                            ...response,
                            duration: endTime - startTime
                        });
                    } catch (error) {
                        reject(new Error(`JSON解析失败: ${error.message}, 原始数据: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    async healthCheck() {
        return new Promise((resolve, reject) => {
            const req = http.get('http://localhost:9999/health', (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
        });
    }

    async getStatus() {
        return new Promise((resolve, reject) => {
            const req = http.get('http://localhost:9999/api/status', (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
        });
    }

    async runTests() {
        console.log('🌐 开始HTTP模式测试...');

        const results = [];

        try {
            // 测试1: 健康检查
            console.log('\n❤️ 测试1: 健康检查');
            const health = await this.healthCheck();
            console.log(`✅ 健康检查通过 - 运行时间: ${health.uptime}s`);
            results.push(true);

        } catch (error) {
            console.log(`❌ 健康检查失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试2: 状态查询
            console.log('\n📊 测试2: 状态查询');
            const status = await this.getStatus();
            console.log(`✅ 状态查询成功 - 连接服务器: ${status.summary.connectedServers}/${status.summary.totalServers}`);
            console.log(`   总工具数: ${status.summary.totalTools}`);
            results.push(true);

        } catch (error) {
            console.log(`❌ 状态查询失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试3: 工具列表
            console.log('\n🔧 测试3: 获取工具列表');
            const toolsResponse = await this.sendRequest('tools/list', {});
            if (toolsResponse.result && toolsResponse.result.tools) {
                const tools = toolsResponse.result.tools;
                console.log(`✅ 工具列表获取成功 - 共${tools.length}个工具 (耗时: ${toolsResponse.duration.toFixed(2)}ms)`);

                // 显示前几个工具
                console.log('   示例工具:');
                tools.slice(0, 3).forEach(tool => {
                    console.log(`   - ${tool.name}: ${tool.description.substring(0, 50)}...`);
                });
                results.push(true);
            } else {
                throw new Error('响应格式错误');
            }

        } catch (error) {
            console.log(`❌ 工具列表获取失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试4: 文件读取
            console.log('\n📄 测试4: 文件读取');
            const fileResponse = await this.sendRequest('tools/call', {
                name: 'Filesystem##read_text_file',
                arguments: { path: './package.json' }
            });

            if (fileResponse.result && fileResponse.result.content) {
                const content = fileResponse.result.content[0].text;
                if (content.includes('mcps-proxy')) {
                    console.log(`✅ 文件读取成功 (耗时: ${fileResponse.duration.toFixed(2)}ms)`);
                    results.push(true);
                } else {
                    throw new Error('文件内容不匹配');
                }
            } else {
                throw new Error('响应格式错误');
            }

        } catch (error) {
            console.log(`❌ 文件读取失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试5: 时间获取
            console.log('\n⏰ 测试5: 时间获取');
            const timeResponse = await this.sendRequest('tools/call', {
                name: 'Time##get_current_time',
                arguments: { timezone: 'Asia/Shanghai' }
            });

            if (timeResponse.result && timeResponse.result.content) {
                console.log(`✅ 时间获取成功 (耗时: ${timeResponse.duration.toFixed(2)}ms)`);
                console.log(`   当前时间: ${timeResponse.result.content[0].text}`);
                results.push(true);
            } else {
                throw new Error('响应格式错误');
            }

        } catch (error) {
            console.log(`❌ 时间获取失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试6: 资源列表
            console.log('\n📚 测试6: 资源列表');
            const resourcesResponse = await this.sendRequest('resources/list', {});
            if (resourcesResponse.result) {
                const resources = resourcesResponse.result.resources || [];
                console.log(`✅ 资源列表获取成功 - 共${resources.length}个资源 (耗时: ${resourcesResponse.duration.toFixed(2)}ms)`);
                results.push(true);
            } else {
                throw new Error('响应格式错误');
            }

        } catch (error) {
            console.log(`❌ 资源列表获取失败: ${error.message}`);
            results.push(false);
        }

        try {
            // 测试7: 错误处理
            console.log('\n❌ 测试7: 错误处理');
            const errorResponse = await this.sendRequest('tools/call', {
                name: 'non-existent-tool',
                arguments: {}
            });

            if (errorResponse.result && errorResponse.result.isError) {
                console.log(`✅ 错误处理正常 - 正确返回错误 (耗时: ${errorResponse.duration.toFixed(2)}ms)`);
                results.push(true);
            } else {
                throw new Error('应该返回错误但没有');
            }

        } catch (error) {
            console.log(`❌ 错误处理失败: ${error.message}`);
            results.push(false);
        }

        // 测试结果统计
        const passed = results.filter(r => r).length;
        const total = results.length;
        console.log(`\n📊 HTTP模式测试结果:`);
        console.log(`   通过测试: ${passed}/${total}`);
        console.log(`   通过率: ${(passed/total*100).toFixed(1)}%`);

        return passed === total;
    }

    async performanceTest(iterations = 10) {
        console.log('\n⚡ 开始性能测试...');

        const times = [];
        const totalStart = performance.now();

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await this.sendRequest('tools/list', {});
            const end = performance.now();
            times.push(end - start);

            // 显示进度
            process.stdout.write(`\r   进度: ${i+1}/${iterations} (${Math.round((i+1)/iterations*100)}%)`);
        }

        const totalEnd = performance.now();
        console.log(`\n✅ 性能测试完成`);

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const totalTime = totalEnd - totalStart;

        console.log(`\n📊 性能统计 (${iterations}次请求):`);
        console.log(`   总耗时: ${totalTime.toFixed(2)}ms`);
        console.log(`   平均响应时间: ${avgTime.toFixed(2)}ms`);
        console.log(`   最快响应时间: ${minTime.toFixed(2)}ms`);
        console.log(`   最慢响应时间: ${maxTime.toFixed(2)}ms`);
        console.log(`   吞吐量: ${(iterations / totalTime * 1000).toFixed(2)} 请求/秒`);

        return { avgTime, minTime, maxTime, totalTime, throughput: iterations / totalTime * 1000 };
    }
}

async function main() {
    const tester = new HTTPModeTester();

    try {
        // 功能测试
        const success = await tester.runTests();

        if (success) {
            // 性能测试
            await tester.performanceTest(20);
        }

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = HTTPModeTester;
#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const { performance } = require('perf_hooks');

class ModeComparisonTester {
    constructor() {
        this.httpBaseUrl = 'http://localhost:9999';
        this.requestId = 0;
    }

    async testHTTPMode(iterations = 20) {
        console.log('🌐 测试HTTP模式性能...');

        const times = [];

        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();

            await this.sendHTTPRequest('tools/list', {});

            const endTime = performance.now();
            times.push(endTime - startTime);

            process.stdout.write(`\r   进度: ${i+1}/${iterations} (${Math.round((i+1)/iterations*100)}%)`);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        console.log(`\n✅ HTTP模式测试完成`);
        console.log(`   平均响应时间: ${avgTime.toFixed(2)}ms`);
        console.log(`   最快响应时间: ${minTime.toFixed(2)}ms`);
        console.log(`   最慢响应时间: ${maxTime.toFixed(2)}ms`);
        console.log(`   吞吐量: ${(iterations / (times.reduce((a, b) => a + b, 0) / 1000)).toFixed(2)} 请求/秒`);

        return {
            mode: 'HTTP',
            avgTime,
            minTime,
            maxTime,
            throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000)
        };
    }

    async testSTDIOMode(iterations = 20) {
        console.log('\n📡 测试STDIO模式性能...');

        // 启动STDIO模式
        const proxy = spawn('node', ['dist/cli.js', '--stdio'], {
            stdio: ['pipe', 'pipe', 'inherit']
        });

        let responseBuffer = '';
        let testResults = [];
        let pendingRequests = new Map();

        // 收集响应
        proxy.stdout.on('data', (data) => {
            responseBuffer += data.toString();
            const lines = responseBuffer.split('\n');
            responseBuffer = lines.pop() || '';

            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line.trim());
                        const resolver = pendingRequests.get(response.id);
                        if (resolver) {
                            resolver(response);
                            pendingRequests.delete(response.id);
                        }
                    } catch (error) {
                        // 忽略非JSON行
                    }
                }
            });
        });

        // 等待启动
        await new Promise(resolve => setTimeout(resolve, 3000));

        const times = [];

        try {
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();

                await this.sendSTDIORequest(proxy, pendingRequests, 'tools/list', {});

                const endTime = performance.now();
                times.push(endTime - startTime);

                process.stdout.write(`\r   进度: ${i+1}/${iterations} (${Math.round((i+1)/iterations*100)}%)`);
            }
        } catch (error) {
            console.error('\nSTDIO模式测试失败:', error);
        } finally {
            proxy.kill();
        }

        if (times.length > 0) {
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            console.log(`\n✅ STDIO模式测试完成`);
            console.log(`   平均响应时间: ${avgTime.toFixed(2)}ms`);
            console.log(`   最快响应时间: ${minTime.toFixed(2)}ms`);
            console.log(`   最慢响应时间: ${maxTime.toFixed(2)}ms`);
            console.log(`   吞吐量: ${(iterations / (times.reduce((a, b) => a + b, 0) / 1000)).toFixed(2)} 请求/秒`);

            return {
                mode: 'STDIO',
                avgTime,
                minTime,
                maxTime,
                throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000)
            };
        } else {
            throw new Error('STDIO模式测试失败，没有收到响应');
        }
    }

    async sendHTTPRequest(method, params, schema = 'default') {
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

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    async sendSTDIORequest(process, pendingRequests, method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const request = {
                jsonrpc: "2.0",
                method: method,
                params: params,
                id
            };

            // 设置超时
            const timeout = setTimeout(() => {
                pendingRequests.delete(id);
                reject(new Error('请求超时'));
            }, 5000);

            // 存储解析器
            pendingRequests.set(id, (response) => {
                clearTimeout(timeout);
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    resolve(response);
                }
            });

            // 发送请求
            process.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    async compareFeatures() {
        console.log('\n🔍 功能对比分析...');

        const features = [];

        // HTTP模式特性
        features.push({
            feature: '多Schema支持',
            http: '✅ 支持',
            stdio: '❌ 单Schema',
            description: 'HTTP模式支持同时访问多个schema，STDIO模式只能指定一个schema'
        });

        features.push({
            feature: 'Web界面访问',
            http: '✅ 支持',
            stdio: '❌ 不支持',
            description: 'HTTP模式提供Web API和状态页面，STDIO模式无Web界面'
        });

        features.push({
            feature: 'CORS支持',
            http: '✅ 支持',
            stdio: '❌ 不适用',
            description: 'HTTP模式支持跨域请求，适合Web应用集成'
        });

        features.push({
            feature: '命令行集成',
            http: '⚠️ 间接',
            stdio: '✅ 原生',
            description: 'STDIO模式更适合命令行工具和脚本集成'
        });

        features.push({
            feature: '进程间通信',
            http: '⚠️ 需要网络',
            stdio: '✅ 直接',
            description: 'STDIO模式使用标准输入输出，通信更直接高效'
        });

        features.push({
            feature: '调试便利性',
            http: '✅ 便利',
            stdio: '⚠️ 复杂',
            description: 'HTTP模式更容易调试，有明确的端点和状态'
        });

        features.push({
            feature: '资源使用',
            http: '⚠️ 较高',
            stdio: '✅ 较低',
            description: 'STDIO模式只初始化指定schema，资源使用更少'
        });

        features.push({
            feature: '部署复杂度',
            http: '⚠️ 需要端口',
            stdio: '✅ 简单',
            description: 'STDIO模式无需端口管理，部署更简单'
        });

        console.log('\n📊 功能对比表:');
        console.log('| 功能特性 | HTTP模式 | STDIO模式 | 说明 |');
        console.log('|---------|---------|----------|------|');
        features.forEach(f => {
            console.log(`| ${f.feature} | ${f.http} | ${f.stdio} | ${f.description} |`);
        });
    }

    async runComparison() {
        console.log('🔄 开始HTTP与STDIO模式对比测试...\n');

        // 确保HTTP服务器运行
        try {
            await this.sendHTTPRequest('tools/list', {});
            console.log('✅ HTTP服务器已就绪');
        } catch (error) {
            console.log('❌ HTTP服务器未就绪，请先启动HTTP模式');
            return;
        }

        // 性能对比
        const httpResults = await this.testHTTPMode(15);
        const stdioResults = await this.testSTDIOMode(15);

        // 功能对比
        await this.compareFeatures();

        // 性能对比总结
        console.log('\n📈 性能对比总结:');
        console.log('| 指标 | HTTP模式 | STDIO模式 | 优势 |');
        console.log('|------|---------|----------|------|');

        const speedImprovement = ((httpResults.avgTime - stdioResults.avgTime) / httpResults.avgTime * 100).toFixed(1);
        const throughputImprovement = ((stdioResults.throughput - httpResults.throughput) / httpResults.throughput * 100).toFixed(1);

        console.log(`| 平均响应时间 | ${httpResults.avgTime.toFixed(2)}ms | ${stdioResults.avgTime.toFixed(2)}ms | STDIO快${speedImprovement}% |`);
        console.log(`| 最快响应时间 | ${httpResults.minTime.toFixed(2)}ms | ${stdioResults.minTime.toFixed(2)}ms | ${stdioResults.minTime < httpResults.minTime ? 'STDIO' : 'HTTP'}更快 |`);
        console.log(`| 吞吐量 | ${httpResults.throughput.toFixed(2)} req/s | ${stdioResults.throughput.toFixed(2)} req/s | STDIO高${throughputImprovement}% |`);

        // 使用建议
        console.log('\n💡 使用建议:');
        console.log('📱 选择HTTP模式，如果需要:');
        console.log('   • Web应用集成');
        console.log('   • 多Schema同时访问');
        console.log('   • API服务提供');
        console.log('   • 跨域访问支持');
        console.log('   • 可视化状态监控');

        console.log('\n💻 选择STDIO模式，如果需要:');
        console.log('   • 命令行工具集成');
        console.log('   • CI/CD流水线');
        console.log('   • 高性能场景');
        console.log('   • 资源受限环境');
        console.log('   • 简单部署需求');

        console.log('\n🎯 两种模式都完全可用，根据具体需求选择合适的模式！');
    }
}

async function main() {
    const tester = new ModeComparisonTester();

    try {
        await tester.runComparison();
    } catch (error) {
        console.error('对比测试失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ModeComparisonTester;
#!/usr/bin/env node

const { spawn } = require('child_process');

async function testSTDIO() {
    console.log('🧪 开始简单的STDIO模式测试...');

    const proxy = spawn('node', ['dist/cli.js', '--stdio'], {
        stdio: ['pipe', 'pipe', 'inherit']
    });

    let responseBuffer = '';
    let testResults = [];

    // 收集输出
    proxy.stdout.on('data', (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || '';

        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line.trim());
                    console.log('📥 收到响应:', JSON.stringify(response, null, 2));

                    if (response.result && response.result.tools) {
                        testResults.push('✅ 工具列表获取成功');

                        // 显示前几个工具名称
                        const tools = response.result.tools.slice(0, 3);
                        console.log('🔧 可用工具示例:');
                        tools.forEach(tool => {
                            console.log(`  - ${tool.name}: ${tool.description}`);
                        });

                        // 测试一个工具调用
                        const firstTool = response.result.tools[0];
                        if (firstTool && firstTool.name) {
                            console.log(`🧪 测试调用工具: ${firstTool.name}`);

                            const testCall = {
                                jsonrpc: "2.0",
                                method: "tools/call",
                                params: {
                                    name: firstTool.name,
                                    arguments: {}
                                },
                                id: 2
                            };

                            proxy.stdin.write(JSON.stringify(testCall) + '\n');
                        }
                    } else if (response.error) {
                        testResults.push(`❌ 收到错误: ${response.error.message}`);
                    } else {
                        testResults.push('✅ 工具调用响应');
                    }
                } catch (error) {
                    console.log('📝 非JSON输出:', line);
                }
            }
        });
    });

    proxy.on('error', (error) => {
        console.error('❌ 进程错误:', error);
        testResults.push('❌ 进程错误');
    });

    proxy.on('exit', (code) => {
        console.log(`\n📊 测试完成，退出码: ${code}`);
        console.log('\n🎯 测试结果:');
        testResults.forEach(result => console.log(result));
    });

    // 等待启动
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // 发送工具列表请求
        const request = {
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
            id: 1
        };

        console.log('📤 发送请求:', JSON.stringify(request, null, 2));
        proxy.stdin.write(JSON.stringify(request) + '\n');

        // 5秒后结束测试
        setTimeout(() => {
            proxy.kill();
        }, 5000);

    } catch (error) {
        console.error('❌ 发送请求失败:', error);
        proxy.kill();
    }
}

if (require.main === module) {
    testSTDIO().catch(console.error);
}

module.exports = { testSTDIO };
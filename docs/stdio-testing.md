# STDIO模式测试指南

本指南详细介绍如何测试mcps-proxy的STDIO模式功能。

## 📋 目录

- [🧪 快速测试](#-快速测试)
- [🔧 手动测试方法](#-手动测试方法)
- [🤖 自动化测试脚本](#-自动化测试脚本)
- [💻 编程语言集成测试](#-编程语言集成测试)
- [📊 性能测试](#-性能测试)
- [🐛 故障排除](#-故障排除)

## 🧪 快速测试

### 1. 基础功能测试

```bash
# 测试工具列表获取
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node dist/cli.js --stdio

# 测试工具调用
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"Filesystem-read_file","arguments":{"path":"./README.md"}},"id":2}' | node dist/cli.js --stdio
```

### 2. Schema切换测试

```bash
# 测试默认schema
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node dist/cli.js --stdio --schema default

# 测试其他schema（如果配置了）
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node dist/cli.js --stdio --schema workspace
```

## 🔧 手动测试方法

### 交互式测试

1. **启动STDIO模式**
   ```bash
   node dist/cli.js --stdio
   ```

2. **手动输入请求**（在终端中逐行输入）：
   ```json
   {"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}
   ```

3. **查看响应** - 应该返回工具列表

4. **测试工具调用**：
   ```json
   {"jsonrpc":"2.0","method":"tools/call","params":{"name":"Filesystem-read_file","arguments":{"path":"./package.json"}},"id":2}
   ```

### 批量测试

创建一个测试文件 `test_requests.txt`：

```
{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}
{"jsonrpc":"2.0","method":"resources/list","params":{},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"Filesystem-read_file","arguments":{"path":"./README.md"}},"id":3}
```

执行批量测试：
```bash
cat test_requests.txt | node dist/cli.js --stdio
```

## 🤖 自动化测试脚本

### Bash测试脚本

创建 `test_stdio.sh`：

```bash
#!/bin/bash

echo "🧪 开始STDIO模式测试..."

# 检查构建状态
if [ ! -f "dist/cli.js" ]; then
    echo "❌ 项目未构建，请先运行 npm run build"
    exit 1
fi

# 测试1: 获取工具列表
echo "📋 测试1: 获取工具列表"
response1=$(echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | timeout 10s node dist/cli.js --stdio)
if [[ $response1 == *"\"result\":"* ]]; then
    echo "✅ 工具列表获取成功"
else
    echo "❌ 工具列表获取失败"
    echo "响应: $response1"
fi

# 测试2: 调用文件读取工具
echo "📄 测试2: 调用文件读取工具"
response2=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"Filesystem-read_file","arguments":{"path":"./package.json"}},"id":2}' | timeout 10s node dist/cli.js --stdio)
if [[ $response2 == *"\"name\":"* ]] && [[ $response2 == *"mcps-proxy"* ]]; then
    echo "✅ 文件读取工具调用成功"
else
    echo "❌ 文件读取工具调用失败"
    echo "响应: $response2"
fi

# 测试3: 错误处理
echo "❌ 测试3: 错误处理"
response3=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"non-existent-tool","arguments":{}},"id":3}' | timeout 10s node dist/cli.js --stdio)
if [[ $response3 == *"\"error\":"* ]]; then
    echo "✅ 错误处理正常"
else
    echo "❌ 错误处理异常"
    echo "响应: $response3"
fi

echo "🎉 STDIO模式测试完成！"
```

### Node.js测试脚本

创建 `test_stdio.js`：

```javascript
const { spawn } = require('child_process');
const { EOL } = require('os');

class STDIOTester {
    constructor() {
        this.requestId = 0;
    }

    async runTest(schema = 'default') {
        console.log(`🧪 开始STDIO模式测试 (schema: ${schema})...`);

        const proxy = spawn('node', ['dist/cli.js', '--stdio', '--schema', schema]);
        let responseBuffer = '';
        let testResults = [];

        // 收集响应
        proxy.stdout.on('data', (data) => {
            responseBuffer += data.toString();
            const lines = responseBuffer.split(EOL);
            responseBuffer = lines.pop() || '';

            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line.trim());
                        this.handleResponse(response, testResults);
                    } catch (error) {
                        console.error('解析响应失败:', error, line);
                    }
                }
            });
        });

        proxy.stderr.on('data', (data) => {
            console.error('STDERR:', data.toString());
        });

        proxy.on('error', (error) => {
            console.error('进程错误:', error);
        });

        // 等待进程启动
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // 测试1: 获取工具列表
            await this.sendRequest(proxy, 'tools/list', {});
            await this.waitForResponse(testResults, 5000);

            // 测试2: 调用文件读取工具
            await this.sendRequest(proxy, 'tools/call', {
                name: 'Filesystem-read_file',
                arguments: { path: './package.json' }
            });
            await this.waitForResponse(testResults, 5000);

            // 测试3: 错误处理
            await this.sendRequest(proxy, 'tools/call', {
                name: 'non-existent-tool',
                arguments: {}
            });
            await this.waitForResponse(testResults, 5000);

        } catch (error) {
            console.error('测试过程中出错:', error);
        } finally {
            proxy.kill();
        }

        // 输出测试结果
        console.log('\n📊 测试结果:');
        testResults.forEach(result => {
            console.log(`${result.status} ${result.message}`);
        });

        const passedTests = testResults.filter(r => r.status === '✅').length;
        const totalTests = testResults.length;
        console.log(`\n🎯 测试通过率: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);

        return passedTests === totalTests;
    }

    async sendRequest(process, method, params) {
        const request = {
            jsonrpc: "2.0",
            method: method,
            params: params,
            id: ++this.requestId
        };

        return new Promise((resolve, reject) => {
            process.stdin.write(JSON.stringify(request) + EOL);
            setTimeout(resolve, 100);
        });
    }

    handleResponse(response, testResults) {
        if (response.error) {
            if (response.id === 3) {
                testResults.push({
                    status: '✅',
                    message: '错误处理测试通过 - 正确返回错误'
                });
            } else {
                testResults.push({
                    status: '❌',
                    message: `意外错误: ${response.error.message}`
                });
            }
        } else if (response.result) {
            if (response.id === 1 && response.result.tools) {
                testResults.push({
                    status: '✅',
                    message: `工具列表获取成功 - 共${response.result.tools.length}个工具`
                });
            } else if (response.id === 2 && response.result.content) {
                testResults.push({
                    status: '✅',
                    message: '文件读取工具调用成功'
                });
            }
        }
    }

    async waitForResponse(testResults, timeout) {
        return new Promise(resolve => {
            const startTime = Date.now();
            const checkResponse = () => {
                if (testResults.length >= this.requestId) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    console.warn(`等待响应超时 (${timeout}ms)`);
                    resolve();
                } else {
                    setTimeout(checkResponse, 100);
                }
            };
            checkResponse();
        });
    }
}

// 运行测试
async function main() {
    const tester = new STDIOTester();

    try {
        const success = await tester.runTest('default');
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = STDIOTester;
```

## 💻 编程语言集成测试

### Python集成测试

创建 `test_stdio_python.py`：

```python
#!/usr/bin/env python3
"""
mcps-proxy STDIO模式Python测试脚本
"""

import subprocess
import json
import sys
import time
import threading
from queue import Queue, Empty

class STDIOProxyTester:
    def __init__(self, schema='default'):
        self.schema = schema
        self.process = None
        self.request_id = 0
        self.response_queue = Queue()
        self.running = False

    def start_proxy(self):
        """启动STDIO代理"""
        try:
            self.process = subprocess.Popen(
                ['node', 'dist/cli.js', '--stdio', '--schema', self.schema],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )

            # 启动响应读取线程
            self.running = True
            response_thread = threading.Thread(target=self._read_responses)
            response_thread.daemon = True
            response_thread.start()

            # 等待启动完成
            time.sleep(2)
            return True
        except Exception as e:
            print(f"❌ 启动代理失败: {e}")
            return False

    def _read_responses(self):
        """读取响应的线程函数"""
        while self.running and self.process and self.process.poll() is None:
            try:
                line = self.process.stdout.readline()
                if line:
                    line = line.strip()
                    if line:
                        try:
                            response = json.loads(line)
                            self.response_queue.put(response)
                        except json.JSONDecodeError as e:
                            print(f"⚠️ JSON解析错误: {e}, 行内容: {line}")
            except Exception as e:
                if self.running:
                    print(f"⚠️ 读取响应错误: {e}")

    def send_request(self, method, params=None, timeout=10):
        """发送请求并等待响应"""
        if not self.process:
            return None

        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }

        try:
            # 发送请求
            self.process.stdin.write(json.dumps(request) + '\n')
            self.process.stdin.flush()

            # 等待响应
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    response = self.response_queue.get(timeout=0.1)
                    if response.get('id') == self.request_id:
                        return response
                except Empty:
                    continue

            print(f"⚠️ 请求超时: {method}")
            return None

        except Exception as e:
            print(f"❌ 发送请求失败: {e}")
            return None

    def stop_proxy(self):
        """停止代理"""
        self.running = False
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()

    def run_tests(self):
        """运行所有测试"""
        print(f"🧪 开始STDIO模式Python测试 (schema: {self.schema})...")

        if not self.start_proxy():
            return False

        try:
            tests = [
                self.test_tools_list,
                self.test_file_read,
                self.test_error_handling,
                self.test_resources_list
            ]

            results = []
            for test in tests:
                try:
                    result = test()
                    results.append(result)
                except Exception as e:
                    print(f"❌ 测试 {test.__name__} 失败: {e}")
                    results.append(False)

            # 输出结果
            passed = sum(results)
            total = len(results)
            print(f"\n📊 测试结果: {passed}/{total} 通过")
            print(f"🎯 通过率: {passed/total*100:.1f}%")

            return passed == total

        finally:
            self.stop_proxy()

    def test_tools_list(self):
        """测试工具列表获取"""
        print("📋 测试1: 获取工具列表")

        response = self.send_request('tools/list', {})
        if response and 'result' in response and 'tools' in response['result']:
            tools = response['result']['tools']
            print(f"✅ 工具列表获取成功，共{len(tools)}个工具")
            return True
        else:
            print(f"❌ 工具列表获取失败: {response}")
            return False

    def test_file_read(self):
        """测试文件读取"""
        print("📄 测试2: 文件读取")

        response = self.send_request('tools/call', {
            'name': 'Filesystem-read_file',
            'arguments': {'path': './package.json'}
        })

        if response and 'result' in response and 'content' in response['result']:
            content = response['result']['content'][0]['text']
            if 'mcps-proxy' in content:
                print("✅ 文件读取成功")
                return True
            else:
                print("❌ 文件内容不匹配")
                return False
        else:
            print(f"❌ 文件读取失败: {response}")
            return False

    def test_error_handling(self):
        """测试错误处理"""
        print("❌ 测试3: 错误处理")

        response = self.send_request('tools/call', {
            'name': 'non-existent-tool',
            'arguments': {}
        })

        if response and 'error' in response:
            print("✅ 错误处理正常，正确返回错误")
            return True
        else:
            print("❌ 错误处理异常，应该返回错误")
            return False

    def test_resources_list(self):
        """测试资源列表"""
        print("📚 测试4: 获取资源列表")

        response = self.send_request('resources/list', {})
        if response and 'result' in response:
            resources = response['result'].get('resources', [])
            print(f"✅ 资源列表获取成功，共{len(resources)}个资源")
            return True
        else:
            print(f"❌ 资源列表获取失败: {response}")
            return False

def main():
    """主函数"""
    if len(sys.argv) > 1:
        schema = sys.argv[1]
    else:
        schema = 'default'

    tester = STDIOProxyTester(schema)
    success = tester.run_tests()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
```

### Go集成测试

创建 `test_stdio.go`：

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "os/exec"
    "time"
)

type Request struct {
    JSONRPC string      `json:"jsonrpc"`
    Method  string      `json:"method"`
    Params  interface{} `json:"params"`
    ID      int         `json:"id"`
}

type Response struct {
    JSONRPC string      `json:"jsonrpc"`
    ID      int         `json:"id"`
    Result  interface{} `json:"result,omitempty"`
    Error   *Error      `json:"error,omitempty"`
}

type Error struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
}

type STDIOTester struct {
    cmd     *exec.Cmd
    stdin   io.WriteCloser
    stdout  io.Reader
    scanner *bufio.Scanner
    reqID   int
}

func NewSTDIOTester(schema string) (*STDIOTester, error) {
    cmd := exec.Command("node", "dist/cli.js", "--stdio", "--schema", schema)

    stdin, err := cmd.StdinPipe()
    if err != nil {
        return nil, fmt.Errorf("创建stdin管道失败: %v", err)
    }

    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return nil, fmt.Errorf("创建stdout管道失败: %v", err)
    }

    if err := cmd.Start(); err != nil {
        return nil, fmt.Errorf("启动进程失败: %v", err)
    }

    // 等待启动
    time.Sleep(2 * time.Second)

    return &STDIOTester{
        cmd:     cmd,
        stdin:   stdin,
        stdout:  stdout,
        scanner: bufio.NewScanner(stdout),
        reqID:   0,
    }, nil
}

func (t *STDIOTester) SendRequest(method string, params interface{}) (*Response, error) {
    t.reqID++
    req := Request{
        JSONRPC: "2.0",
        Method:  method,
        Params:  params,
        ID:      t.reqID,
    }

    // 发送请求
    reqBytes, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("序列化请求失败: %v", err)
    }

    if _, err := fmt.Fprintln(t.stdin, string(reqBytes)); err != nil {
        return nil, fmt.Errorf("发送请求失败: %v", err)
    }

    // 读取响应
    for t.scanner.Scan() {
        var resp Response
        if err := json.Unmarshal(t.scanner.Bytes(), &resp); err != nil {
            continue // 忽略无法解析的行
        }
        if resp.ID == t.reqID {
            return &resp, nil
        }
    }

    return nil, fmt.Errorf("读取响应超时")
}

func (t *STDIOTester) Close() error {
    t.stdin.Close()
    return t.cmd.Wait()
}

func runTests() bool {
    fmt.Println("🧪 开始STDIO模式Go测试...")

    tester, err := NewSTDIOTester("default")
    if err != nil {
        log.Printf("❌ 创建测试器失败: %v", err)
        return false
    }
    defer tester.Close()

    tests := []struct {
        name string
        test func() bool
    }{
        {"工具列表", testToolsList},
        {"文件读取", testFileRead},
        {"错误处理", testErrorHandling},
    }

    passed := 0
    total := len(tests)

    for _, test := range tests {
        fmt.Printf("🔍 运行测试: %s\n", test.name)
        if test.test() {
            passed++
            fmt.Printf("✅ %s 测试通过\n", test.name)
        } else {
            fmt.Printf("❌ %s 测试失败\n", test.name)
        }
    }

    fmt.Printf("\n📊 测试结果: %d/%d 通过\n", passed, total)
    fmt.Printf("🎯 通过率: %.1f%%\n", float64(passed)/float64(total)*100)

    return passed == total
}

func testToolsList() bool {
    tester, err := NewSTDIOTester("default")
    if err != nil {
        return false
    }
    defer tester.Close()

    resp, err := tester.SendRequest("tools/list", nil)
    if err != nil {
        log.Printf("发送请求失败: %v", err)
        return false
    }

    if resp.Error != nil {
        log.Printf("返回错误: %s", resp.Error.Message)
        return false
    }

    result, ok := resp.Result.(map[string]interface{})
    if !ok {
        log.Printf("结果格式错误")
        return false
    }

    tools, ok := result["tools"].([]interface{})
    if !ok {
        log.Printf("工具列表格式错误")
        return false
    }

    log.Printf("获取到 %d 个工具", len(tools))
    return true
}

func testFileRead() bool {
    tester, err := NewSTDIOTester("default")
    if err != nil {
        return false
    }
    defer tester.Close()

    params := map[string]interface{}{
        "name": "Filesystem-read_file",
        "arguments": map[string]string{
            "path": "./package.json",
        },
    }

    resp, err := tester.SendRequest("tools/call", params)
    if err != nil {
        log.Printf("发送请求失败: %v", err)
        return false
    }

    if resp.Error != nil {
        log.Printf("返回错误: %s", resp.Error.Message)
        return false
    }

    result, ok := resp.Result.(map[string]interface{})
    if !ok {
        log.Printf("结果格式错误")
        return false
    }

    content, ok := result["content"].([]interface{})
    if !ok {
        log.Printf("内容格式错误")
        return false
    }

    if len(content) == 0 {
        log.Printf("内容为空")
        return false
    }

    log.Printf("文件读取成功")
    return true
}

func testErrorHandling() bool {
    tester, err := NewSTDIOTester("default")
    if err != nil {
        return false
    }
    defer tester.Close()

    params := map[string]interface{}{
        "name": "non-existent-tool",
        "arguments": map[string]interface{}{},
    }

    resp, err := tester.SendRequest("tools/call", params)
    if err != nil {
        log.Printf("发送请求失败: %v", err)
        return false
    }

    if resp.Error == nil {
        log.Printf("应该返回错误但没有")
        return false
    }

    log.Printf("错误处理正常: %s", resp.Error.Message)
    return true
}

func main() {
    success := runTests()
    if success {
        fmt.Println("🎉 所有测试通过！")
        os.Exit(0)
    } else {
        fmt.Println("💥 测试失败！")
        os.Exit(1)
    }
}
```

## 📊 性能测试

### 基准测试脚本

创建 `benchmark_stdio.js`：

```javascript
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class STDIOBenchmark {
    constructor() {
        this.requestId = 0;
        this.process = null;
        this.pendingRequests = new Map();
    }

    async start(schema = 'default') {
        this.process = spawn('node', ['dist/cli.js', '--stdio', '--schema', schema]);

        this.process.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line.trim());
                        const resolver = this.pendingRequests.get(response.id);
                        if (resolver) {
                            resolver(response);
                            this.pendingRequests.delete(response.id);
                        }
                    } catch (error) {
                        // 忽略解析错误
                    }
                }
            });
        });

        // 等待启动
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const request = {
                jsonrpc: "2.0",
                method,
                params,
                id
            };

            // 设置超时
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('请求超时'));
            }, 5000);

            // 存储解析器
            this.pendingRequests.set(id, (response) => {
                clearTimeout(timeout);
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    resolve(response.result);
                }
            });

            // 发送请求
            this.process.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    async benchmarkToolsList(iterations = 100) {
        console.log(`🚀 工具列表性能测试 (${iterations}次迭代)...`);

        const times = [];

        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            await this.sendRequest('tools/list', {});
            const endTime = performance.now();
            times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        console.log(`📊 性能统计:`);
        console.log(`   平均响应时间: ${avgTime.toFixed(2)}ms`);
        console.log(`   最快响应时间: ${minTime.toFixed(2)}ms`);
        console.log(`   最慢响应时间: ${maxTime.toFixed(2)}ms`);
        console.log(`   总请求数: ${iterations}`);
        console.log(`   吞吐量: ${(1000 / avgTime).toFixed(2)} 请求/秒`);

        return { avgTime, minTime, maxTime, throughput: 1000 / avgTime };
    }

    async benchmarkConcurrentRequests(concurrency = 10, totalRequests = 100) {
        console.log(`⚡ 并发性能测试 (${concurrency}并发, ${totalRequests}总请求)...`);

        const startTime = performance.now();
        const promises = [];

        for (let i = 0; i < totalRequests; i++) {
            promises.push(this.sendRequest('tools/list', {}));

            // 控制并发数
            if (promises.length >= concurrency) {
                await Promise.all(promises);
                promises.length = 0;
            }
        }

        // 处理剩余请求
        if (promises.length > 0) {
            await Promise.all(promises);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        console.log(`📊 并发性能统计:`);
        console.log(`   总耗时: ${totalTime.toFixed(2)}ms`);
        console.log(`   总请求数: ${totalRequests}`);
        console.log(`   并发数: ${concurrency}`);
        console.log(`   平均响应时间: ${(totalTime / totalRequests).toFixed(2)}ms`);
        console.log(`   吞吐量: ${(totalRequests / totalTime * 1000).toFixed(2)} 请求/秒`);
    }

    stop() {
        if (this.process) {
            this.process.kill();
        }
    }
}

async function main() {
    const benchmark = new STDIOBenchmark();

    try {
        await benchmark.start();

        // 单线程性能测试
        await benchmark.benchmarkToolsList(50);

        console.log();

        // 并发性能测试
        await benchmark.benchmarkConcurrentRequests(5, 50);

    } catch (error) {
        console.error('基准测试失败:', error);
    } finally {
        benchmark.stop();
    }
}

if (require.main === module) {
    main();
}
```

## 🐛 故障排除

### 常见问题及解决方案

1. **进程启动失败**
   ```bash
   # 检查Node.js版本
   node --version  # 需要 >= 22.0.0

   # 检查构建状态
   ls -la dist/cli.js
   ```

2. **请求无响应**
   ```bash
   # 检查配置文件
   cat ~/.mcps-proxy/config.json

   # 查看错误日志
   tail -f ~/.mcps-proxy/logs/mcps-proxy.log
   ```

3. **JSON解析错误**
   ```bash
   # 验证JSON格式
   echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | jq .
   ```

4. **超时问题**
   - 检查MCP服务器是否正常启动
   - 增加超时时间
   - 检查系统资源使用情况

### 调试技巧

```bash
# 启用调试模式
DEBUG=mcps-proxy:* node dist/cli.js --stdio

# 使用strace跟踪系统调用（Linux）
strace -e trace=write,read -o debug.log node dist/cli.js --stdio

# 使用Process Monitor（Windows）
# 监控文件句柄和网络连接
```

---

## 📝 测试清单

在发布前，请确保以下测试都通过：

- [ ] 基础工具列表获取
- [ ] 文件读取工具调用
- [ ] 错误处理机制
- [ ] 资源列表获取
- [ ] Schema切换功能
- [ ] 并发请求处理
- [ ] 长时间运行稳定性
- [ ] 内存泄漏检查
- [ ] 性能基准测试

使用这些测试脚本和工具，您可以全面验证STDIO模式的功能和性能。
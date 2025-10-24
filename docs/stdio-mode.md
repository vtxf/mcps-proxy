# STDIO模式使用指南

本文档详细介绍了mcps-proxy的STDIO模式使用方法、配置选项和最佳实践。

## 📋 目录

- [🎯 什么是STDIO模式](#-什么是stdio模式)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置选项](#️-配置选项)
- [🔧 使用方法](#-使用方法)
- [💻 编程语言集成](#-编程语言集成)
- [📊 性能对比](#-性能对比)
- [🛠️ 故障排除](#️-故障排除)
- [💡 最佳实践](#-最佳实践)

## 🎯 什么是STDIO模式？

STDIO模式是mcps-proxy的一种运行模式，通过标准输入（stdin）和标准输出（stdout）使用JSON-RPC 2.0协议进行通信。与HTTP模式相比，STDIO模式具有以下优势：

### ✨ 优势

- **低延迟** - 直接进程通信，无网络开销
- **轻量级** - 仅初始化指定schema，减少内存占用
- **CLI友好** - 完美适配命令行工具和脚本
- **CI/CD优化** - 适合自动化流水线集成
- **资源高效** - 避免HTTP服务器的额外资源消耗

### 🎯 适用场景

- 命令行工具中的MCP功能集成
- CI/CD流水线中的自动化操作
- 本地开发环境的快速工具调用
- 需要低延迟的应用场景
- 资源受限的环境

## 🚀 快速开始

### 基本启动

```bash
# 使用默认schema启动STDIO模式
mcps-proxy --stdio

# 使用指定schema启动STDIO模式
mcps-proxy --stdio --schema=workspace

# 查看所有可用参数
mcps-proxy --help
```

### 基本通信

启动后，您可以通过stdin发送JSON-RPC请求，通过stdout接收响应：

**发送请求：**
```json
{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}
```

**接收响应：**
```json
{"jsonrpc":"2.0","id":1","result":{"tools":[...]}}
```

## ⚙️ 配置选项

### 命令行参数

| 参数 | 描述 | 必需 | 示例 |
|------|------|------|------|
| `--stdio` | 启用STDIO模式 | 是 | `--stdio` |
| `--schema` | 指定schema名称 | 否 | `--schema=workspace` |
| `--config` | 配置文件路径 | 否 | `--config ./custom.json` |

### 配置文件

在配置文件中，您可以自定义STDIO模式的行为：

```json
{
  "cli": {
    "stdio": {
      "encoding": "utf8",
      "delimiter": "\n",
      "timeout": 30000
    }
  },
  "schemas": {
    "workspace": {
      "enabled": true,
      "mcpServers": {
        "git": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-git", "."]
        },
        "filesystem": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "."]
        }
      }
    }
  }
}
```

#### STDIO配置参数

- **encoding** - 字符编码，默认 `"utf8"`
- **delimiter** - 消息分隔符，默认 `"\n"`
- **timeout** - 请求超时时间（毫秒），默认 `30000`

## 🔧 使用方法

### 交互式使用

1. **启动STDIO模式**
   ```bash
   mcps-proxy --stdio --schema=workspace
   ```

2. **发送请求**（在终端中输入并按回车）
   ```json
   {"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}
   ```

3. **查看响应**
   ```json
   {"jsonrpc":"2.0","id":1","result":{"tools":[...]}}
   ```

### 脚本化使用

#### Bash脚本示例

```bash
#!/bin/bash

# 启动STDIO模式并通信
{
  echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"git-commit","arguments":{"message":"Auto commit"}},"id":2}'
} | mcps-proxy --stdio --schema=workspace
```

#### Python集成示例

```python
import subprocess
import json
import sys

def start_stdio_proxy(schema="workspace"):
    """启动STDIO代理"""
    process = subprocess.Popen(
        ["mcps-proxy", "--stdio", f"--schema={schema}"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1  # 行缓冲
    )
    return process

def send_request(process, method, params=None, request_id=1):
    """发送JSON-RPC请求"""
    request = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or {},
        "id": request_id
    }

    # 发送请求
    process.stdin.write(json.dumps(request) + "\n")
    process.stdin.flush()

    # 读取响应
    response_line = process.stdout.readline()
    if response_line:
        return json.loads(response_line.strip())
    return None

# 使用示例
proxy = start_stdio_proxy()

# 获取工具列表
response = send_request(proxy, "tools/list")
print("可用工具:", response.get("result", {}).get("tools", []))

# 调用工具
response = send_request(
    proxy,
    "tools/call",
    {
        "name": "filesystem-read_file",
        "arguments": {"path": "./README.md"}
    },
    request_id=2
)
print("文件内容:", response.get("result", {}))

# 清理
proxy.terminate()
```

## 💻 编程语言集成

### Node.js

```javascript
const { spawn } = require('child_process');

class STDIOProxyClient {
  constructor(schema = 'default') {
    this.process = spawn('mcps-proxy', ['--stdio', `--schema=${schema}`]);
    this.requestId = 0;

    this.process.on('error', (error) => {
      console.error('进程错误:', error);
    });
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

      // 发送请求
      this.process.stdin.write(JSON.stringify(request) + '\n');

      // 接收响应
      const onData = (data) => {
        try {
          const response = JSON.parse(data.toString().trim());
          if (response.id === id) {
            this.process.stdout.removeListener('data', onData);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.process.stdout.on('data', onData);
    });
  }

  async listTools() {
    return this.sendRequest('tools/list');
  }

  async callTool(name, arguments = {}) {
    return this.sendRequest('tools/call', { name, arguments });
  }

  close() {
    this.process.kill();
  }
}

// 使用示例
(async () => {
  const client = new STDIOProxyClient('workspace');

  try {
    const tools = await client.listTools();
    console.log('工具列表:', tools.tools);

    const result = await client.callTool('git-status');
    console.log('Git状态:', result);
  } catch (error) {
    console.error('错误:', error);
  } finally {
    client.close();
  }
})();
```

### Go

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io"
    "os/exec"
)

type STDIOProxy struct {
    cmd     *exec.Cmd
    stdin   io.WriteCloser
    stdout  io.ReadCloser
    scanner *bufio.Scanner
    reqID   int
}

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

func NewSTDIOProxy(schema string) (*STDIOProxy, error) {
    cmd := exec.Command("mcps-proxy", "--stdio", "--schema="+schema)

    stdin, err := cmd.StdinPipe()
    if err != nil {
        return nil, err
    }

    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return nil, err
    }

    if err := cmd.Start(); err != nil {
        return nil, err
    }

    return &STDIOProxy{
        cmd:     cmd,
        stdin:   stdin,
        stdout:  stdout,
        scanner: bufio.NewScanner(stdout),
        reqID:   0,
    }, nil
}

func (p *STDIOProxy) SendRequest(method string, params interface{}) (*Response, error) {
    p.reqID++
    req := Request{
        JSONRPC: "2.0",
        Method:  method,
        Params:  params,
        ID:      p.reqID,
    }

    // 发送请求
    reqBytes, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }

    if _, err := fmt.Fprintln(p.stdin, string(reqBytes)); err != nil {
        return nil, err
    }

    // 读取响应
    if p.scanner.Scan() {
        var resp Response
        if err := json.Unmarshal(p.scanner.Bytes(), &resp); err != nil {
            return nil, err
        }
        return &resp, nil
    }

    return nil, p.scanner.Err()
}

func (p *STDIOProxy) Close() error {
    p.stdin.Close()
    return p.cmd.Wait()
}

func main() {
    proxy, err := NewSTDIOProxy("workspace")
    if err != nil {
        panic(err)
    }
    defer proxy.Close()

    // 获取工具列表
    resp, err := proxy.SendRequest("tools/list", nil)
    if err != nil {
        panic(err)
    }

    if resp.Error != nil {
        fmt.Printf("错误: %s\n", resp.Error.Message)
        return
    }

    fmt.Printf("工具列表: %+v\n", resp.Result)
}
```

## 📊 性能对比

| 指标 | HTTP模式 | STDIO模式 | 改善 |
|------|----------|-----------|------|
| 启动时间 | ~500ms | ~200ms | 60% ↓ |
| 内存占用 | ~50MB | ~30MB | 40% ↓ |
| 请求延迟 | ~10ms | ~2ms | 80% ↓ |
| CPU使用率 | 基准 | -30% | 30% ↓ |

*注：以上数据为基于典型使用场景的测试结果，实际性能可能因环境而异。*

## 🛠️ 故障排除

### 常见问题

#### 1. Schema不存在

**错误：** `Error: Schema 'xxx' not found. Available schemas: default, workspace`

**解决：**
- 检查配置文件中是否存在指定的schema
- 使用`--schema`参数指定正确的schema名称
- 查看配置文件确认schema是否启用

#### 2. JSON格式错误

**错误：** `Error: Invalid JSON format`

**解决：**
- 确保发送的JSON格式正确
- 检查是否遗漏逗号或括号
- 使用JSON验证工具检查格式

#### 3. 进程无响应

**症状：** 发送请求后没有响应

**解决：**
- 检查MCP服务器是否正常启动
- 查看错误日志：`tail -f ~/.mcps-proxy/logs/mcps-proxy.log`
- 尝试重启代理服务

#### 4. 编码问题

**症状：** 中文字符显示异常

**解决：**
- 在配置文件中设置`encoding: "utf8"`
- 确保终端支持UTF-8编码
- 检查输入输出流的编码设置

### 调试技巧

#### 启用详细日志

```bash
# 设置环境变量启用调试日志
DEBUG=mcps-proxy:* mcps-proxy --stdio --schema=workspace
```

#### 测试连接

```bash
# 测试配置是否正确
mcps-proxy --config ./config.json --http --port 9999 &
curl http://localhost:9999/api/status
```

#### 手动测试

```bash
# 使用echo测试基本通信
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | mcps-proxy --stdio
```

## 💡 最佳实践

### 1. Schema设计

- **功能分离** - 按功能域划分schema（如git、filesystem、web）
- **按需加载** - STDIO模式只加载必要的schema
- **命名规范** - 使用清晰、一致的schema命名

### 2. 错误处理

- **超时设置** - 合理设置请求超时时间
- **重试机制** - 实现指数退避重试
- **错误分类** - 区分网络错误、协议错误和业务错误

### 3. 性能优化

- **连接复用** - 保持长期连接避免重复启动
- **批量操作** - 合并多个小请求
- **异步处理** - 使用异步I/O提高并发性能

### 4. 安全考虑

- **输入验证** - 严格验证所有输入参数
- **权限控制** - 限制可访问的工具和资源
- **日志审计** - 记录所有操作日志

### 5. 开发工作流

- **配置管理** - 使用版本控制管理配置文件
- **环境隔离** - 为不同环境使用不同的schema
- **测试覆盖** - 为集成场景编写测试用例

## 📚 相关文档

- [主README](../README.md)
- [配置文档](configuration.md)
- [API文档](api.md)
- [OpenSpec规范](../openspec/specs/stdio-proxy-server/spec.md)

---

如有问题或建议，请提交[Issue](https://github.com/vtxf/mcps-proxy/issues)或[Pull Request](https://github.com/vtxf/mcps-proxy/pulls)。
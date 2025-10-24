# API 文档

## 概述

mcps-proxy 提供HTTP API接口来访问MCP服务器的功能。API基于JSON-RPC 2.0协议，支持工具调用、资源访问和提示模板功能。

## 基础信息

- **协议**: HTTP + JSON-RPC 2.0
- **默认端口**: 3095
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## API端点

### 1. 健康检查

**端点**: `GET /health`

检查服务是否正常运行。

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-19T10:30:00.000Z",
  "uptime": 3600.123
}
```

### 2. 状态查询

**端点**: `GET /api/status`

获取服务器和所有MCP服务器的状态信息。

**响应示例**:
```json
{
  "server": {
    "status": "running",
    "port": 3095,
    "url": "http://localhost:3095",
    "uptime": "01:00:00"
  },
  "schemas": {
    "default": {
      "status": "active",
      "mcpServers": [
        {
          "id": "filesystem",
          "name": "文件系统服务器",
          "status": "connected",
          "type": "stdio",
          "toolCount": 8
        }
      ],
      "totalTools": 8,
      "connectedServers": 1
    }
  },
  "summary": {
    "totalSchemas": 1,
    "activeSchemas": 1,
    "totalServers": 1,
    "connectedServers": 1,
    "failedServers": 0,
    "totalTools": 8
  }
}
```

### 3. MCP协议端点

**端点**: `POST /api/{schema}/mcp`

统一的MCP协议端点，支持所有MCP功能。

**路径参数**:
- `schema`: Schema名称，对应配置文件中定义的schema

**请求体**: JSON-RPC 2.0格式

## MCP协议方法

### tools/list - 获取工具列表

获取指定schema中所有可用的工具。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "filesystem-read_file",
        "description": "读取文件内容",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "文件路径"
            }
          },
          "required": ["path"]
        }
      }
    ]
  }
}
```

### tools/call - 调用工具

执行指定的工具。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "filesystem-read_file",
      "arguments": {
        "path": "./package.json"
      }
    },
    "id": 2
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{
  \"name\": \"my-package\",
  \"version\": \"1.1.0\"
}"
      }
    ]
  }
}
```

### resources/list - 获取资源列表

获取指定schema中所有可用的资源。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list",
    "params": {},
    "id": 3
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "resources": [
      {
        "uri": "file://./README.md",
        "name": "README",
        "description": "项目说明文档",
        "mimeType": "text/markdown"
      }
    ]
  }
}
```

### resources/read - 读取资源

读取指定资源的内容。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": {
      "uri": "file://./README.md"
    },
    "id": 4
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "contents": [
      {
        "uri": "file://./README.md",
        "mimeType": "text/markdown",
        "text": "# 项目标题\n\n这是项目说明..."
      }
    ]
  }
}
```

### prompts/list - 获取提示列表

获取指定schema中所有可用的提示模板。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts/list",
    "params": {},
    "id": 5
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "prompts": [
      {
        "name": "code-review",
        "description": "代码审查提示",
        "arguments": [
          {
            "name": "language",
            "description": "编程语言",
            "required": true
          }
        ]
      }
    ]
  }
}
```

### prompts/get - 获取提示内容

获取指定提示模板的内容。

**请求示例**:
```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts/get",
    "params": {
      "name": "code-review",
      "arguments": {
        "language": "typescript"
      }
    },
    "id": 6
  }'
```

**响应示例**:
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "description": "代码审查提示模板",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "请审查以下TypeScript代码，关注代码质量、性能和最佳实践。"
        }
      }
    ]
  }
}
```

## 错误处理

### 标准错误格式

所有错误响应都遵循JSON-RPC 2.0错误格式：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "path",
      "issue": "Required field missing"
    }
  }
}
```

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| -32700 | Parse error | 检查JSON格式是否正确 |
| -32600 | Invalid Request | 检查请求格式是否符合JSON-RPC 2.0 |
| -32601 | Method not found | 检查方法名是否正确 |
| -32602 | Invalid params | 检查参数格式和必需字段 |
| -32603 | Internal error | 服务器内部错误，查看日志 |
| 404 | Schema not found | 检查schema名称是否存在且启用 |

### Schema错误

当尝试访问不存在的schema或已禁用的schema时：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": 404,
    "message": "Schema 'unknown' not found or disabled"
  }
}
```

## 工具命名规则

所有工具都采用"服务器ID-工具名"的统一命名格式：

- `filesystem-read_file`: 来自filesystem服务器的read_file工具
- `git-commit`: 来自git服务器的commit工具
- `web-search-webSearchPrime`: 来自web-search服务器的webSearchPrime工具

## 认证和安全

### CORS支持

mcps-proxy 支持跨域资源共享(CORS)，可在配置文件中设置：

```json
{
  "server": {
    "cors": {
      "enabled": true,
      "origins": ["https://yourdomain.com"],
      "methods": ["GET", "POST"],
      "credentials": false
    }
  }
}
```

### API密钥

虽然mcps-proxy本身不提供认证机制，但建议：

1. 使用反向代理(如Nginx)添加认证
2. 配置防火墙限制访问
3. 在生产环境中使用HTTPS

## 使用示例

### JavaScript客户端

```javascript
class McpsProxyClient {
    constructor(baseUrl, schema = 'default') {
        this.baseUrl = baseUrl;
        this.schema = schema;
        this.id = 1;
    }

    async request(method, params = {}) {
        const response = await fetch(`${this.baseUrl}/api/${this.schema}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: this.id++
            })
        });

        return response.json();
    }

    async getTools() {
        return this.request('tools/list');
    }

    async callTool(toolName, args) {
        return this.request('tools/call', {
            name: toolName,
            arguments: args
        });
    }
}

// 使用示例
const client = new McpsProxyClient('http://localhost:3095');

// 获取工具列表
client.getTools().then(result => {
    console.log('可用工具:', result.result.tools);
});

// 调用工具
client.callTool('filesystem-read_file', {path: './package.json'}).then(result => {
    console.log('文件内容:', result.result.content[0].text);
});
```

### Python客户端

```python
import requests
import json

class McpsProxyClient:
    def __init__(self, base_url, schema='default'):
        self.base_url = base_url
        self.schema = schema
        self.id = 1

    def request(self, method, params=None):
        response = requests.post(
            f"{self.base_url}/api/{self.schema}/mcp",
            headers={'Content-Type': 'application/json'},
            json={
                'jsonrpc': '2.0',
                'method': method,
                'params': params or {},
                'id': self.id
            }
        )
        self.id += 1
        return response.json()

    def get_tools(self):
        return self.request('tools/list')

    def call_tool(self, tool_name, args):
        return self.request('tools/call', {
            'name': tool_name,
            'arguments': args
        })

# 使用示例
client = McpsProxyClient('http://localhost:3095')

# 获取工具列表
tools = client.get_tools()
print('可用工具:', tools['result']['tools'])

# 调用工具
result = client.call_tool('filesystem-read_file', {'path': './package.json'})
print('文件内容:', result['result']['content'][0]['text'])
```

## 性能考虑

1. **请求超时**: 默认超时时间为30秒，可在配置中调整
2. **并发限制**: 建议在反向代理层面设置并发限制
3. **缓存策略**: HTTP服务器和MCP服务器层面可能需要缓存
4. **监控**: 定期检查 `/api/status` 端点监控服务状态

## 调试

### 启用调试日志

在配置文件中设置日志级别为debug：

```json
{
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

### 常见问题

1. **工具调用失败**: 检查工具名称和参数格式
2. **连接超时**: 检查MCP服务器状态和网络连接
3. **Schema不可用**: 确认schema已启用且MCP服务器正常连接

### 日志位置

- 控制台输出: 实时显示（如果启用）
- 日志文件: `~/.mcps-proxy/logs/mcps-proxy.log`
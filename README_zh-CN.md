# mcps-proxy

一个极简的MCP（Model Context Protocol）服务器代理工具，将多个独立的MCP服务器合并成统一的HTTP和STDIO接口。

[![npm version](https://badge.fury.io/js/mcps-proxy.svg)](https://badge.fury.io/js/mcps-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

**语言:** [English](README.md) | [简体中文](README_zh-CN.md)

## 📋 目录

- [✨ 特性](#-特性)
- [🚀 快速开始](#-快速开始)
- [📖 API 使用](#-api-使用)
- [⚙️ 配置](#️-配置)
- [🔧 开发](#-开发)
- [📁 项目结构](#-项目结构)
- [🌐 API文档](#-api文档)
- [🚀 部署](#-部署)
- [🔍 故障排除](#-故障排除)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)

## ✨ 特性

- 🚀 **极简设计** - 轻量级代理，专注核心功能，最小依赖
- 🔌 **多服务器支持** - 同时连接stdio、http、sse三种类型的MCP服务器
- 📡 **双接口模式** - 通过HTTP API或STDIO接口访问所有MCP功能
- 🌐 **CORS支持** - 支持跨域访问，便于Web应用集成
- 📝 **完整日志** - 结构化日志记录，支持文件和控制台输出
- 🔧 **零配置启动** - 首次运行自动创建默认配置
- 🔄 **Schema管理** - 支持多环境配置，schema级别的启用/禁用控制
- 🛡️ **错误处理** - 完善的错误处理和重连机制
- 📊 **状态监控** - 实时监控所有MCP服务器状态
- ⚡ **性能优化** - STDIO模式提供更低延迟和更少资源占用

## 🚀 快速开始

### 安装

```bash
# 全局安装
npm install -g mcps-proxy

# 或本地安装
npm install mcps-proxy
```

### 启动服务

#### HTTP模式（默认）

```bash
# 使用默认配置启动
mcps-proxy

# 指定端口启动
mcps-proxy --port 8080

# 使用自定义配置文件
mcps-proxy --config ./my-config.json
```

服务启动后将在 `http://localhost:3095` 提供API服务。

#### STDIO模式

```bash
# 启动STDIO模式，使用默认schema
mcps-proxy --stdio

# 启动STDIO模式，使用指定schema
mcps-proxy --stdio --schema=workspace

# 查看帮助
mcps-proxy --help
```

STDIO模式通过标准输入输出使用JSON-RPC 2.0协议通信，完美适配CLI工具集成和CI/CD流水线。

## 📖 API 使用

### 工具命名规则

所有工具都采用"服务器ID-工具名"的统一命名格式，例如：
- `filesystem-read_file`
- `git-commit`
- `web-search-webSearchPrime`

### HTTP API 使用

#### 获取工具列表

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

#### 调用工具

```bash
curl -X POST http://localhost:3095/api/default/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "filesystem-read_file",
      "arguments": {"path": "./package.json"}
    },
    "id": 2
  }'
```

#### 状态查询

```bash
curl http://localhost:3095/api/status
```

### STDIO 接口使用

STDIO模式通过标准输入输出使用JSON-RPC 2.0协议通信。使用方法如下：

#### 启动STDIO模式

```bash
mcps-proxy --stdio --schema=workspace
```

#### 通过STDIN发送请求

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 1
}
```

#### 通过STDOUT接收响应

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "git-commit",
        "description": "创建新提交",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": {"type": "string"},
            "files": {"type": "array", "items": {"type": "string"}}
          }
        }
      }
    ]
  }
}
```

#### 工具调用示例

**输入：**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "filesystem-read_file",
    "arguments": {"path": "./package.json"}
  },
  "id": 2
}
```

**输出：**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"name\": \"mcps-proxy\", \"version\": \"1.1.0\"}"
      }
    ]
  }
}
```

#### Node.js 集成示例

```javascript
const { spawn } = require('child_process');

// 启动STDIO模式
const proxy = spawn('mcps-proxy', ['--stdio', '--schema=workspace']);

// 发送请求
const request = {
  jsonrpc: "2.0",
  method: "tools/list",
  params: {},
  id: 1
};

proxy.stdin.write(JSON.stringify(request) + '\n');

// 接收响应
proxy.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString().trim());
  console.log('工具列表:', response.result.tools);
});
```

## ⚙️ 配置

配置文件位置：`~/.mcps-proxy/config.json`

### 基础配置示例

```json
{
  "server": {
    "port": 3095,
    "host": "0.0.0.0"
  },
  "cli": {
    "stdio": {
      "encoding": "utf8",
      "delimiter": "\n",
      "timeout": 30000
    }
  },
  "schemas": {
    "default": {
      "enabled": true,
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "."]
        }
      }
    },
    "workspace": {
      "enabled": true,
      "mcpServers": {
        "git": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-git", "."]
        }
      }
    }
  }
}
```

### STDIO模式配置

`cli.stdio` 部分控制STDIO模式的行为：

- `encoding` - STDIO通信的字符编码（默认："utf8"）
- `delimiter` - 消息分隔符（默认："\n"）
- `timeout` - 请求超时时间，毫秒（默认：30000）

### 支持的MCP服务器类型

1. **STDIO类型** - 通过标准输入输出通信的本地进程
2. **HTTP类型** - 通过HTTP API通信的远程服务器
3. **SSE类型** - 通过Server-Sent Events通信的服务器

详细配置说明请参考 [配置文档](docs/configuration.md)。

### 环境变量

配置文件支持环境变量替换：

```json
{
  "mcpServers": {
    "web-search": {
      "type": "http",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

## 🔧 开发

### 环境要求

- Node.js 22+
- TypeScript 5.0+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch
```

### 代码质量

```bash
# 代码检查
npm run lint

# 自动修复代码风格
npm run lint:fix

# 代码格式化
npm run format
```

## 📁 项目结构

```
src/
├── core/                    # 核心模块
│   ├── JSONRPCHandler.ts    # JSON-RPC消息处理
│   ├── HTTPServer.ts        # HTTP服务器
│   ├── HTTPRouter.ts        # 路由处理
│   ├── MCPConnectionManager.ts # MCP连接管理
│   ├── StdioMCPServer.ts    # STDIO类型MCP服务器
│   ├── HTTPMCPServer.ts     # HTTP类型MCP服务器
│   ├── SSEMCPServer.ts      # SSE类型MCP服务器
│   └── StdioProxyServer.ts  # STDIO代理服务器（新增）
├── types/                   # 类型定义
│   ├── MCPTypes.ts          # MCP协议类型
│   └── ConfigTypes.ts       # 配置类型
├── utils/                   # 工具函数
│   ├── Logger.ts            # 日志工具
│   └── ConfigLoader.ts      # 配置加载器
├── interfaces/              # 接口定义
│   ├── IMCPServer.ts        # MCP服务器接口
│   └── IHTTPRouter.ts       # HTTP路由接口
├── applications/            # 应用模式
│   ├── HTTPApplication.ts   # HTTP模式应用（新增）
│   └── STDIOApplication.ts  # STDIO模式应用（新增）
├── app.ts                   # 传统应用入口
└── cli.ts                   # 命令行接口（已更新）

tests/                       # 测试文件
├── unit/                    # 单元测试
└── integration/             # 集成测试

docs/                        # 文档
├── configuration.md         # 配置文档
├── api.md                   # API文档
└── stdio-mode.md           # STDIO模式指南（新增）

schema/                      # JSON Schema
└── config.schema.json       # 配置文件Schema（已更新）

openspec/                    # OpenSpec规范
├── specs/                   # 活跃规范
│   └── stdio-proxy-server/  # STDIO代理服务器规范
└── changes/                 # 变更提案
    └── archive/             # 已归档变更
```

## 🌐 API文档

详细API文档请参考：
- [API接口文档](docs/api.md)
- [配置文档](docs/configuration.md)
- [STDIO模式指南](docs/stdio-mode.md) - **新增！**

### HTTP API端点

- `GET /health` - 健康检查
- `GET /api/status` - 状态查询
- `POST /api/{schema}/mcp` - MCP协议端点

### STDIO接口

- **协议**：JSON-RPC 2.0
- **输入**：标准输入（stdin）
- **输出**：标准输出（stdout）
- **通信方式**：按行分隔的JSON消息

### 支持的MCP方法

HTTP和STDIO模式都支持所有MCP方法：
- `tools/list` - 获取工具列表
- `tools/call` - 调用工具
- `resources/list` - 获取资源列表
- `resources/read` - 读取资源
- `prompts/list` - 获取提示列表
- `prompts/get` - 获取提示内容

## 🚀 部署

### Docker部署

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3095

CMD ["node", "dist/cli.js"]
```

### 系统服务

使用systemd创建系统服务：

```ini
[Unit]
Description=MCPS Proxy Service
After=network.target

[Service]
Type=simple
User=mcps-proxy
WorkingDirectory=/opt/mcps-proxy
ExecStart=/usr/bin/node /opt/mcps-proxy/dist/cli.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 反向代理配置

Nginx配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3095;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔍 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -tulpn | grep :3095
   # 使用其他端口
   mcps-proxy --port 8080
   ```

2. **配置文件错误**
   ```bash
   # 检查JSON格式
   cat ~/.mcps-proxy/config.json | jq empty
   # 重新创建默认配置
   rm ~/.mcps-proxy/config.json && mcps-proxy
   ```

3. **MCP服务器连接失败**
   ```bash
   # 查看错误日志
   tail -f ~/.mcps-proxy/logs/mcps-proxy.log
   # 检查服务器状态
   curl http://localhost:3095/api/status
   ```

### 日志文件

- 主日志：`~/.mcps-proxy/logs/mcps-proxy.log`
- 错误日志：控制台输出

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者

**vtxf** <vtxf@qq.com>

- GitHub: [@vtxf](https://github.com/vtxf)
- Website: [u32.cn](https://u32.cn)

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP协议规范
- [Express.js](https://expressjs.com/) - Web框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全

---

**⭐ 如果这个项目对你有帮助，请给它一个星标！**
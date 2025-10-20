# mcps-proxy

一个极简的MCP（Model Context Protocol）服务器代理工具，将多个独立的MCP服务器合并成一个统一的HTTP接口。

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
- 📡 **统一接口** - 通过HTTP API访问所有MCP功能
- 🌐 **CORS支持** - 支持跨域访问，便于Web应用集成
- 📝 **完整日志** - 结构化日志记录，支持文件和控制台输出
- 🔧 **零配置启动** - 首次运行自动创建默认配置
- 🔄 **Schema管理** - 支持多环境配置，schema级别的启用/禁用控制
- 🛡️ **错误处理** - 完善的错误处理和重连机制
- 📊 **状态监控** - 实时监控所有MCP服务器状态

## 🚀 快速开始

### 安装

```bash
# 全局安装
npm install -g mcps-proxy

# 或本地安装
npm install mcps-proxy
```

### 启动服务

```bash
# 使用默认配置启动
mcps-proxy

# 指定端口启动
mcps-proxy --port 8080

# 使用自定义配置文件
mcps-proxy --config ./my-config.json

# 查看帮助
mcps-proxy --help
```

服务启动后将在 `http://localhost:3095` 提供API服务。

## 📖 API 使用

### 工具命名规则

所有工具都采用"服务器ID-工具名"的统一命名格式，例如：
- `filesystem-read_file`
- `git-commit`
- `web-search-webSearchPrime`

### 获取工具列表

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

### 调用工具

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

### 状态查询

```bash
curl http://localhost:3095/api/status
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
  "schemas": {
    "default": {
      "enabled": true,
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "."]
        }
      }
    }
  }
}
```

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
│   └── SSEMCPServer.ts      # SSE类型MCP服务器
├── types/                   # 类型定义
│   ├── MCPTypes.ts          # MCP协议类型
│   └── ConfigTypes.ts       # 配置类型
├── utils/                   # 工具函数
│   ├── Logger.ts            # 日志工具
│   └── ConfigLoader.ts      # 配置加载器
├── interfaces/              # 接口定义
│   ├── IMCPServer.ts        # MCP服务器接口
│   └── IHTTPRouter.ts       # HTTP路由接口
├── app.ts                   # 应用程序入口
└── cli.ts                   # 命令行接口

tests/                       # 测试文件
├── unit/                    # 单元测试
└── integration/             # 集成测试

docs/                        # 文档
├── configuration.md         # 配置文档
└── api.md                   # API文档

schema/                      # JSON Schema
└── config.schema.json       # 配置文件Schema
```

## 🌐 API文档

详细API文档请参考：
- [API接口文档](docs/api.md)
- [配置文档](docs/configuration.md)

### 主要端点

- `GET /health` - 健康检查
- `GET /api/status` - 状态查询
- `POST /api/{schema}/mcp` - MCP协议端点

### 支持的MCP方法

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
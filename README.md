# mcps-proxy

A minimalist MCP (Model Context Protocol) server proxy tool that consolidates multiple independent MCP servers into a unified HTTP interface.

[![npm version](https://badge.fury.io/js/mcps-proxy.svg)](https://badge.fury.io/js/mcps-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

**Languages:** [English](README.md) | [简体中文](README_zh-CN.md)

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [📖 API Usage](#-api-usage)
- [⚙️ Configuration](#️-configuration)
- [🔧 Development](#-development)
- [📁 Project Structure](#-project-structure)
- [🌐 API Documentation](#-api-documentation)
- [🚀 Deployment](#-deployment)
- [🔍 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

- 🚀 **Minimalist Design** - Lightweight proxy focused on core functionality with minimal dependencies
- 🔌 **Multi-Server Support** - Connect to stdio, http, and sse type MCP servers simultaneously
- 📡 **Unified Interface** - Access all MCP functionality through a single HTTP API
- 🌐 **CORS Support** - Cross-origin access support for easy web application integration
- 📝 **Complete Logging** - Structured logging with file and console output support
- 🔧 **Zero-Config Startup** - Auto-create default configuration on first run
- 🔄 **Schema Management** - Multi-environment configuration with schema-level enable/disable control
- 🛡️ **Error Handling** - Comprehensive error handling and reconnection mechanisms
- 📊 **Status Monitoring** - Real-time monitoring of all MCP server statuses

## 🚀 Quick Start

### Installation

```bash
# Global installation
npm install -g mcps-proxy

# Or local installation
npm install mcps-proxy
```

### Starting the Service

```bash
# Start with default configuration
mcps-proxy

# Start with specific port
mcps-proxy --port 8080

# Use custom configuration file
mcps-proxy --config ./my-config.json

# View help
mcps-proxy --help
```

The service will be available at `http://localhost:3095` after startup.

## 📖 API Usage

### Tool Naming Convention

All tools use the "server-id-tool-name" unified naming format, for example:
- `filesystem-read_file`
- `git-commit`
- `web-search-webSearchPrime`

### Getting Tool List

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

### Calling Tools

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

### Status Query

```bash
curl http://localhost:3095/api/status
```

## ⚙️ Configuration

Configuration file location: `~/.mcps-proxy/config.json`

### Basic Configuration Example

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

### Supported MCP Server Types

1. **STDIO Type** - Local processes communicating via standard input/output
2. **HTTP Type** - Remote servers communicating via HTTP API
3. **SSE Type** - Servers communicating via Server-Sent Events

For detailed configuration instructions, please refer to the [Configuration Documentation](docs/configuration.md).

### Environment Variables

Configuration files support environment variable substitution:

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

## 🔧 Development

### Requirements

- Node.js 22+
- TypeScript 5.0+

### Installing Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Code linting
npm run lint

# Auto-fix code style
npm run lint:fix

# Code formatting
npm run format
```

## 📁 Project Structure

```
src/
├── core/                    # Core modules
│   ├── JSONRPCHandler.ts    # JSON-RPC message handling
│   ├── HTTPServer.ts        # HTTP server
│   ├── HTTPRouter.ts        # Routing handling
│   ├── MCPConnectionManager.ts # MCP connection management
│   ├── StdioMCPServer.ts    # STDIO type MCP server
│   ├── HTTPMCPServer.ts     # HTTP type MCP server
│   └── SSEMCPServer.ts      # SSE type MCP server
├── types/                   # Type definitions
│   ├── MCPTypes.ts          # MCP protocol types
│   └── ConfigTypes.ts       # Configuration types
├── utils/                   # Utility functions
│   ├── Logger.ts            # Logging utilities
│   └── ConfigLoader.ts      # Configuration loader
├── interfaces/              # Interface definitions
│   ├── IMCPServer.ts        # MCP server interface
│   └── IHTTPRouter.ts       # HTTP router interface
├── app.ts                   # Application entry point
└── cli.ts                   # Command line interface

tests/                       # Test files
├── unit/                    # Unit tests
└── integration/             # Integration tests

docs/                        # Documentation
├── configuration.md         # Configuration documentation
└── api.md                   # API documentation

schema/                      # JSON Schema
└── config.schema.json       # Configuration file schema
```

## 🌐 API Documentation

For detailed API documentation, please refer to:
- [API Interface Documentation](docs/api.md)
- [Configuration Documentation](docs/configuration.md)

### Main Endpoints

- `GET /health` - Health check
- `GET /api/status` - Status query
- `POST /api/{schema}/mcp` - MCP protocol endpoint

### Supported MCP Methods

- `tools/list` - Get tool list
- `tools/call` - Call tool
- `resources/list` - Get resource list
- `resources/read` - Read resource
- `prompts/list` - Get prompt list
- `prompts/get` - Get prompt content

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3095

CMD ["node", "dist/cli.js"]
```

### System Service

Create a system service using systemd:

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

### Reverse Proxy Configuration

Nginx configuration example:

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

## 🔍 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3095
   # Use different port
   mcps-proxy --port 8080
   ```

2. **Configuration File Error**
   ```bash
   # Check JSON format
   cat ~/.mcps-proxy/config.json | jq empty
   # Recreate default configuration
   rm ~/.mcps-proxy/config.json && mcps-proxy
   ```

3. **MCP Server Connection Failed**
   ```bash
   # View error logs
   tail -f ~/.mcps-proxy/logs/mcps-proxy.log
   # Check server status
   curl http://localhost:3095/api/status
   ```

### Log Files

- Main log: `~/.mcps-proxy/logs/mcps-proxy.log`
- Error log: Console output

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**vtxf** <vtxf@qq.com>

- GitHub: [@vtxf](https://github.com/vtxf)
- Website: [u32.cn](https://u32.cn)

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP protocol specification
- [Express.js](https://expressjs.com/) - Web framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

**⭐ If this project helps you, please give it a star!**
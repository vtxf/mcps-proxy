# 配置文档

## 概述

mcps-proxy 使用JSON格式的配置文件来管理MCP服务器设置。配置文件默认位于 `~/.mcps-proxy/config.json`，首次运行时会自动创建。

## 配置文件结构

### 基础结构

```json
{
  "$schema": "./schema/config.schema.json",
  "server": {
    "port": 3095,
    "host": "127.0.0.1",
    "cors": { ... }
  },
  "schemas": {
    "schemaName": {
      "enabled": true,
      "mcpServers": { ... }
    }
  },
  "logging": { ... }
}
```

### 服务器配置 (server)

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| port | number | 是 | 3095 | HTTP服务器端口 |
| host | string | 否 | "127.0.0.1" | HTTP服务器主机地址 |
| cors | object | 否 | - | CORS配置 |

#### CORS配置

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| enabled | boolean | true | 是否启用CORS |
| origins | string[] | ["*"] | 允许的源 |
| methods | string[] | ["GET", "POST", "OPTIONS"] | 允许的HTTP方法 |
| credentials | boolean | false | 是否允许凭据 |
| allowedHeaders | string[] | ["Content-Type", "Authorization"] | 允许的请求头 |

### Schema配置 (schemas)

Schema是MCP服务器的逻辑分组，每个schema包含一组MCP服务器。

```json
{
  "schemas": {
    "development": {
      "enabled": true,
      "mcpServers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "./dev"]
        }
      }
    }
  }
}
```

#### Schema字段

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| enabled | boolean | 否 | true | 是否启用此schema |
| mcpServers | object | 是 | - | MCP服务器配置 |

### MCP服务器配置

支持三种类型的MCP服务器：

#### 1. STDIO类型

通过标准输入输出通信的本地进程。

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "."],
  "env": {
    "NODE_ENV": "production"
  },
  "cwd": ".",
  "timeout": 30000,
  "restart": true,
  "restartDelay": 5000
}
```

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| type | string | 否 | "stdio" | 服务器类型 |
| command | string | 是 | - | 启动命令 |
| args | string[] | 否 | [] | 命令参数 |
| env | object | 否 | - | 环境变量 |
| cwd | string | 否 | "." | 工作目录 |
| timeout | number | 否 | 30000 | 超时时间(毫秒) |
| restart | boolean | 否 | true | 是否自动重启 |
| restartDelay | number | 否 | 5000 | 重启延迟(毫秒) |

#### 2. HTTP类型

通过HTTP API通信的远程服务器。

```json
{
  "type": "http",
  "url": "https://api.example.com/mcp",
  "headers": {
    "Authorization": "Bearer ${API_KEY}",
    "Content-Type": "application/json"
  },
  "timeout": 10000,
  "retries": 3,
  "retryDelay": 1000
}
```

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| type | string | 是 | "http" | 服务器类型 |
| url | string | 是 | - | 服务器URL |
| headers | object | 否 | - | HTTP请求头 |
| timeout | number | 否 | 10000 | 请求超时(毫秒) |
| retries | number | 否 | 3 | 重试次数 |
| retryDelay | number | 否 | 1000 | 重试延迟(毫秒) |

#### 3. SSE类型

通过Server-Sent Events通信的服务器。

```json
{
  "type": "sse",
  "url": "http://localhost:8080/sse",
  "headers": {
    "Authorization": "Bearer ${SSE_TOKEN}"
  },
  "reconnectInterval": 1000,
  "maxRetries": 5,
  "timeout": 30000
}
```

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| type | string | 是 | "sse" | 服务器类型 |
| url | string | 是 | - | 服务器URL |
| headers | object | 否 | - | 连接请求头 |
| reconnectInterval | number | 否 | 1000 | 重连间隔(毫秒) |
| maxRetries | number | 否 | 5 | 最大重试次数 |
| timeout | number | 否 | 30000 | 连接超时(毫秒) |

### 日志配置 (logging)

```json
{
  "logging": {
    "level": "info",
    "file": "~/.mcps-proxy/logs/mcps-proxy.log",
    "maxSize": "10MB",
    "maxFiles": 5,
    "console": true
  }
}
```

| 字段 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| level | string | 否 | "info" | 日志级别 |
| file | string | 否 | "~/.mcps-proxy/logs/mcps-proxy.log" | 日志文件路径 |
| maxSize | string | 否 | "10MB" | 最大文件大小 |
| maxFiles | number | 否 | 5 | 最大文件数量 |
| console | boolean | 否 | true | 是否输出到控制台 |

#### 日志级别

- `error`: 只记录错误
- `warn`: 记录警告和错误
- `info`: 记录信息、警告和错误
- `debug`: 记录所有日志

## 环境变量

配置文件支持环境变量替换，使用 `${VAR_NAME}` 格式：

```json
{
  "mcpServers": {
    "web-search": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

设置环境变量：

```bash
# Linux/macOS
export API_KEY="your-api-key-here"

# Windows
set API_KEY=your-api-key-here
```

## 配置验证

mcps-proxy 使用JSON Schema验证配置文件。如果配置有误，启动时会显示详细的错误信息。

### 常见配置错误

1. **端口无效**: 端口必须在1-65535范围内
2. **缺少必需字段**: server和schemas是必需的
3. **无效的MCP服务器配置**: 缺少type、command等必需字段
4. **JSON格式错误**: 语法错误、不匹配的括号等

## 配置示例

### 最小配置

```json
{
  "server": {
    "port": 3095
  },
  "schemas": {
    "default": {
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

### 完整配置

```json
{
  "$schema": "./schema/config.schema.json",
  "server": {
    "port": 3095,
    "host": "0.0.0.0",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000", "https://yourdomain.com"],
      "methods": ["GET", "POST", "OPTIONS"],
      "credentials": false,
      "allowedHeaders": ["Content-Type", "Authorization"]
    }
  },
  "schemas": {
    "development": {
      "enabled": true,
      "mcpServers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "./dev"],
          "env": {
            "NODE_ENV": "development",
            "DEBUG": "true"
          },
          "cwd": "./dev",
          "timeout": 30000,
          "restart": true,
          "restartDelay": 2000
        },
        "database": {
          "type": "http",
          "url": "http://localhost:5432/mcp",
          "headers": {
            "X-API-Key": "${DEV_DB_API_KEY}",
            "Content-Type": "application/json"
          },
          "timeout": 10000,
          "retries": 3,
          "retryDelay": 1000
        }
      }
    },
    "production": {
      "enabled": true,
      "mcpServers": {
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "/app/data"],
          "env": {
            "NODE_ENV": "production"
          },
          "timeout": 60000,
          "restart": true
        },
        "monitoring": {
          "type": "http",
          "url": "https://monitoring.example.com/mcp",
          "headers": {
            "Authorization": "Bearer ${MONITORING_TOKEN}"
          },
          "timeout": 5000
        }
      }
    },
    "disabled": {
      "enabled": false,
      "mcpServers": {
        "debug-tools": {
          "command": "node",
          "args": ["debug-server.js"]
        }
      }
    }
  },
  "logging": {
    "level": "info",
    "file": "~/.mcps-proxy/logs/mcps-proxy.log",
    "maxSize": "100MB",
    "maxFiles": 10,
    "console": true
  }
}
```

## 工具命名规则

所有工具都采用"服务器ID-工具名"的统一命名格式：

- `filesystem-read_file`: 来自filesystem服务器的read_file工具
- `git-commit`: 来自git服务器的commit工具
- `web-search-webSearchPrime`: 来自web-search服务器的webSearchPrime工具

这样可以避免不同服务器之间的工具名冲突，并清楚标识工具的来源。

## 故障排除

### 配置文件不生效

1. 检查配置文件路径是否正确
2. 验证JSON格式是否有效
3. 查看错误日志获取详细信息

### MCP服务器连接失败

1. 检查服务器配置是否正确
2. 验证环境变量是否设置
3. 检查网络连接和防火墙设置

### Schema被禁用

如果schema的enabled字段设置为false，对该schema的所有API请求都会返回404错误。检查配置文件中的enabled设置。
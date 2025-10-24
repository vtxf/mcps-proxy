# Project Context

## Purpose
MCPS Proxy是一个极简主义的MCP（Model Context Protocol）服务器代理工具，旨在将多个独立的MCP服务器整合到一个统一的HTTP接口中。该项目的主要目标包括：

- **统一接口**：为多个MCP服务器提供单一、一致的HTTP API访问点
- **协议支持**：完整支持MCP 2025-06-18规范，包括工具调用、资源管理和提示系统
- **多服务器类型**：支持stdio、HTTP和SSE三种类型的MCP服务器连接
- **最小化设计**：保持轻量级架构，专注核心功能，最小化依赖
- **开发友好**：提供完整的日志记录、错误处理和状态监控功能

## Tech Stack
- **TypeScript 5.2+** - 主要开发语言，提供类型安全
- **Node.js 22+** - 运行时环境，使用最新ES2022特性
- **Express.js 4.18+** - HTTP服务器框架
- **@modelcontextprotocol/sdk 0.5.0** - MCP协议官方SDK
- **CORS 2.8+** - 跨域资源共享支持
- **EventSource 4.0+** - SSE（Server-Sent Events）支持
- **Jest 29+** - 单元测试和集成测试框架
- **ESLint + Prettier** - 代码质量和格式化工具

## Project Conventions

### Code Style
- **缩进**：使用4个空格缩进
- **命名**：类名使用PascalCase，方法和变量使用camelCase，常量使用UPPER_SNAKE_CASE
- **文件组织**：每个主要类一个文件，复杂类使用同名文件夹和index.ts导出
- **导出**：使用`export class`而非`export default`导出类
- **注释**：所有公共方法和复杂逻辑必须添加详细中文注释
- **日志**：关键操作添加结构化日志，便于调试和监控

### Architecture Patterns
- **模块化设计**：按功能划分模块（core、types、utils、interfaces）
- **接口抽象**：定义清晰的接口契约（IMCPServer、IHTTPRouter）
- **依赖注入**：通过构造函数注入依赖，便于测试和解耦
- **错误处理**：统一的错误处理机制，支持标准化错误响应
- **配置驱动**：通过JSON配置文件管理所有服务器连接
- **路径别名**：使用@/前缀的路径别名简化导入

### Testing Strategy
- **单元测试**：核心逻辑的单元测试覆盖率要求80%+
- **集成测试**：完整的API端到端测试
- **MCP合规性测试**：使用verify-mcp-compliance.js验证协议规范
- **测试环境**：独立的test schema配置用于测试
- **CI/CD**：自动化测试和质量检查

### Git Workflow
- **分支策略**：主要分支main，功能分支feature/功能名
- **提交格式**：Conventional Commits规范，如feat:、fix:、docs:等
- **版本管理**：语义化版本控制，遵循SemVer规范
- **发布流程**：通过npm publish发布到公共仓库

## Domain Context
### MCP协议知识
- **协议版本**：当前实现基于MCP 2025-06-18规范
- **核心概念**：Tools（工具）、Resources（资源）、Prompts（提示）
- **通信模式**：JSON-RPC 2.0协议，支持请求-响应和通知模式
- **进度支持**：支持progressToken进行长时间操作的进度跟踪
- **分页机制**：使用cursor机制实现大数据集的分页处理

### 服务器连接类型
- **STDIO**：通过标准输入输出与本地进程通信
- **HTTP**：通过HTTP API与远程服务器通信
- **SSE**：通过Server-Sent Events进行实时通信

### 配置管理
- **环境变量**：支持${VAR_NAME}格式的环境变量替换
- **多环境**：支持多个schema配置，可独立启用/禁用
- **配置验证**：使用JSON Schema验证配置文件格式

## Important Constraints
### 技术约束
- **Node.js版本**：必须Node.js 22+，使用ES2022特性
- **TypeScript严格模式**：启用所有严格类型检查
- **内存使用**：最小化内存占用，避免内存泄漏
- **并发处理**：正确处理并发请求，避免竞态条件
- **错误恢复**：MCP服务器断连时自动重连机制

### 业务约束
- **向后兼容**：保持API的向后兼容性
- **配置文件位置**：用户配置文件固定在~/.mcps-proxy/config.json
- **默认端口**：HTTP服务默认端口3095，可通过参数配置
- **日志文件**：日志文件存储在~/.mcps-proxy/logs/目录

### 安全约束
- **输入验证**：所有用户输入必须验证和清理
- **CORS配置**：默认启用CORS支持，可通过配置控制
- **敏感信息**：不在日志中记录敏感配置信息

## External Dependencies
### 核心依赖
- **@modelcontextprotocol/sdk**：MCP协议官方实现
- **@modelcontextprotocol/inspector**：MCP调试工具
- **Express.js**：Web服务器框架
- **CORS**：跨域资源共享中间件

### MCP服务器生态
- **@modelcontextprotocol/server-filesystem**：文件系统工具
- **@modelcontextprotocol/server-git**：Git版本控制工具
- **@modelcontextprotocol/server-memory**：内存管理工具
- **第三方MCP服务器**：支持任何符合MCP规范的第三方服务器

### 开发工具
- **TypeScript编译器**：tsc编译器
- **tsx**：TypeScript执行器，用于开发调试
- **nodemon**：开发时自动重启工具
- **ESLint/Prettier**：代码质量和格式化

### 运行时环境
- **Node.js运行时**：v22+，支持ES2022特性
- **操作系统**：跨平台支持（Windows、macOS、Linux）
- **包管理器**：npm，支持workspace和lockfile

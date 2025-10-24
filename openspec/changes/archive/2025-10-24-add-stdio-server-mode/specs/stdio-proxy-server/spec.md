# STDIO代理服务器功能规范

## ADDED Requirements

### Requirement: REQ-1 - 命令行模式选择
应用程序 SHALL 支持通过命令行参数选择运行模式。

#### Scenario: 默认HTTP模式
**当** 用户执行 `mcps-proxy` 或 `mcps-proxy --http` 时
**那么** 应用程序应当以HTTP模式启动
**并且** 应当初始化所有配置的schemas
**并且** 应当提供完整的HTTP API服务

#### Scenario: STDIO模式启动
**当** 用户执行 `mcps-proxy --stdio` 时
**那么** 应用程序应当以STDIO模式启动
**并且** 应当仅初始化名为"default"的schema
**并且** 应当监听标准输入以接收JSON-RPC请求

#### Scenario: STDIO模式指定Schema
**当** 用户执行 `mcps-proxy --stdio --schema=workspace` 时
**那么** 应用程序应当以STDIO模式启动
**并且** 应当仅初始化名为"workspace"的schema
**并且** 应当监听标准输入以接收JSON-RPC请求

### Requirement: REQ-2 - STDIO模式JSON-RPC协议支持
STDIO代理服务器 SHALL 完全支持JSON-RPC 2.0协议。

#### Scenario: 处理工具调用请求
**当** 客户端通过stdin发送tools/call请求时
**那么** 服务器应当解析请求参数
**并且** 应当调用当前schema中相应的MCP服务器工具
**并且** 应当将结果通过stdout返回给客户端

#### Scenario: 处理资源读取请求
**当** 客户端通过stdin发送resources/read请求时
**那么** 服务器应当解析请求参数
**并且** 应当从当前schema中相应的MCP服务器读取资源
**并且** 应当将资源内容通过stdout返回给客户端

#### Scenario: 处理提示获取请求
**当** 客户端通过stdin发送prompts/get请求时
**那么** 服务器应当解析请求参数
**并且** 应当从当前schema中相应的MCP服务器获取提示
**并且** 应当将提示内容通过stdout返回给客户端

### Requirement: REQ-3 - Schema初始化策略
应用程序 SHALL 根据运行模式采用不同的schema初始化策略。

#### Scenario: HTTP模式Schema初始化
**当** 应用程序以HTTP模式启动时
**那么** 应当初始化配置文件中所有启用的schemas
**并且** 应该为每个schema建立独立的MCP连接
**并且** 应当支持通过URL路径路由到指定schema

#### Scenario: STDIO模式Schema初始化
**当** 应用程序以STDIO模式启动时
**那么** 应当仅初始化命令行指定的schema（默认为"default"）
**并且** 应该仅为该schema建立MCP连接
**并且** 不应该初始化其他schemas

#### Scenario: Schema不存在处理
**当** STDIO模式指定的schema不存在时
**那么** 应用程序应当启动失败
**并且** 应当显示明确的错误信息
**并且** 应当退出并返回非零状态码

### Requirement: REQ-4 - 命令行参数解析
CLI SHALL 正确解析新的命令行参数。

#### Scenario: 基本参数解析
**当** 用户执行 `mcps-proxy --stdio` 时
**那么** CLI应当正确识别STDIO模式
**并且** 应当使用默认schema名称"default"

#### Scenario: 完整参数解析
**当** 用户执行 `mcps-proxy --stdio --schema=workspace` 时
**那么** CLI应当正确识别STDIO模式
**并且** 应当解析schema名称为"workspace"
**并且** 应当传递给应用程序

#### Scenario: 参数冲突检测
**当** 用户同时指定 `--stdio` 和 `--http` 参数时
**那么** CLI应当显示错误信息
**并且** 应当退出并返回非零状态码

### Requirement: REQ-5 - 配置系统扩展
配置系统 SHALL 扩展以支持CLI模式相关配置。

#### Scenario: CLI配置加载
**当** 加载配置文件时
**那么** 系统应当能够解析cli.stdio配置段
**并且** 应当为STDIO模式提供合理的默认值
**并且** 应当验证配置的有效性

#### Scenario: 配置验证
**当** STDIO模式配置无效时
**那么** 系统应当使用默认配置
**并且** 应当记录警告日志
**并且** 不应该阻止应用启动

## ADDED Requirements (续)

### Requirement: REQ-6 - 应用程序架构扩展
应用程序 SHALL 扩展架构以支持模式选择。

#### Scenario: 模式化构造
**当** 创建STDIO应用程序实例时
**那么** 构造函数 SHALL 接受schema名称参数
**并且** SHALL 仅初始化STDIO模式相关组件
**并且** SHALL 避免创建HTTP服务器实例

#### Scenario: 条件性Schema初始化
**当** STDIO应用程序启动时
**那么** SHALL 仅初始化命令行指定的schema
**并且** SHALL 跳过其他schemas的初始化
**并且** SHALL 提供清晰的初始化状态反馈

#### Scenario: 服务器创建策略
**当** 启动STDIO服务器时
**那么** SHALL 创建StdioProxyServer实例
**并且** SHALL 配置JSON-RPC 2.0协议处理
**并且** SHALL 设置标准输入输出监听

### Requirement: REQ-7 - 命令行界面扩展
CLI界面 SHALL 扩展以反映新的模式选择功能。

#### Scenario: 帮助信息更新
**当** 用户执行 `mcps-proxy --help` 时
**那么** 帮助信息 SHALL 包含新的参数说明
**并且** SHALL 显示STDIO模式的使用示例
**并且** SHALL 说明schema参数的作用

#### Scenario: 启动信息显示
**当** STDIO应用程序启动成功时
**那么** SHALL 显示模式信息和当前schema名称
**并且** SHALL 提供STDIO通信的使用提示
**并且** SHALL 确认JSON-RPC 2.0协议就绪

#### Scenario: 错误信息改进
**当** STDIO模式启动失败时
**那么** SHALL 显示具体的错误信息
**并且** SHALL 提供解决建议
**并且** SHALL 显示正确的使用示例

### Requirement: REQ-8 - 测试策略扩展
测试策略 SHALL 扩展以覆盖新的模式选择功能。

#### Scenario: 模式选择测试
**当** 测试CLI功能时
**那么** SHALL 测试各种参数组合
**并且** SHALL 验证模式选择的正确性
**并且** SHALL 测试错误参数的处理

#### Scenario: Schema隔离测试
**当** 测试STDIO模式时
**那么** SHALL 验证仅初始化指定schema
**并且** SHALL 测试schema不存在的错误处理
**并且** SHALL 验证schema隔离的正确性

## Technical Implementation Details

### 命令行参数扩展

```typescript
interface CLIOptions {
    // 现有参数
    port?: number;
    config?: string;
    version?: boolean;
    help?: boolean;
    
    // 新增参数
    mode?: "http" | "stdio";
    schema?: string;
}
```

### CLI命令示例

```bash
# HTTP模式（默认）
mcps-proxy
mcps-proxy --http
mcps-proxy --port 8080

# STDIO模式
mcps-proxy --stdio
mcps_proxy --stdio --schema=workspace
mcps_proxy --stdio --schema=tools

# 帮助信息
mcps-proxy --help
```

### STDIO请求格式

```json
{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
        "name": "read_file",
        "arguments": {
            "path": "/path/to/file"
        }
    },
    "id": 1
}
```

### STDIO响应格式

```json
{
    "jsonrpc": "2.0",
    "result": {
        "content": [
            {
                "type": "text",
                "text": "文件内容"
            }
        ],
        "isError": false
    },
    "id": 1
}
```

### 配置结构扩展

```typescript
interface Config {
    server: ServerConfig;  // HTTP服务器配置
    cli?: {
        stdio?: STDIOConfig;  // STDIO模式配置
    };
    schemas: Record<string, SchemaConfig>;
    logging?: LoggingConfig;
}

interface STDIOConfig {
    encoding?: string;    // 默认"utf8"
    delimiter?: string;   // 默认"\n"
    timeout?: number;     // 请求超时时间
}
```

### Application类重构

```typescript
export class Application {
    private server?: HTTPServer | StdioProxyServer;
    private connectionManager: MCPConnectionManager;
    private mode: "http" | "stdio";

    constructor(config: Config, mode: "http" | "stdio") {
        this.config = config;
        this.mode = mode;
        this.connectionManager = new MCPConnectionManager();
    }

    public async start(schemaName?: string): Promise<void> {
        if (this.mode === "stdio") {
            await this.initializeSingleSchema(schemaName || "default");
            this.server = new StdioProxyServer(this.connectionManager, this.config.cli?.stdio);
        } else {
            await this.initializeAllSchemas();
            this.server = new HTTPServer(this.connectionManager, this.config.server);
        }
        
        await this.server.start();
    }
}
```

## Acceptance Criteria

### 功能验收标准
- [ ] `mcps-proxy --stdio` 能够启动STDIO模式并使用default schema
- [ ] `mcps-proxy --stdio --schema=workspace` 能够启动STDIO模式并使用指定schema
- [ ] `mcps-proxy --http` 能够启动HTTP模式并支持所有schemas
- [ ] STDIO模式能够处理所有MCP协议操作
- [ ] Schema不存在时能够正确显示错误信息
- [ ] 命令行参数冲突时能够正确处理

### 性能验收标准
- [ ] STDIO模式仅初始化指定schema，内存使用减少
- [ ] STDIO模式请求响应时间<100ms
- [ ] 模式切换不影响启动性能

### 兼容性验收标准
- [ ] 现有HTTP模式功能保持完全不变
- [ ] 现有配置文件格式向后兼容
- [ ] 命令行参数向后兼容

### 可靠性验收标准
- [ ] 错误处理机制完整且一致
- [ ] 日志记录详细且结构化
- [ ] 优雅关闭功能正常工作
- [ ] 所有边界情况都有适当处理
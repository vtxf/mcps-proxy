# stdio-proxy-server Specification

## Purpose
TBD - created by archiving change add-stdio-server-mode. Update Purpose after archive.
## Requirements
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


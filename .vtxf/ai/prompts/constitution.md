# 开发一个MCP服务器的代理工具

## 目标
mcps-proxy 为一个简洁的MCP（Model Context Protocol）服务器代理工具，能够将多个独立的MCP服务器合并成一个统一的HTTP MCP服务器，提供一个统一的接口来访问所有后端服务器的功能。

## targets目录
[MUST] 搭建项目时必须严格遵守目录中的所有文档！
目录`.vtxf\ai\prompts\targets`中的文档资料是需要严格遵守且作为项目的开发文档来使用的。
该目录 有如下文件：
- 开发需求规格说明.md
- 常见问题.md
- 配置示例.md
- 终端用户使用指南.md
- 配置文件的示例和schema：config.example.json / config.schema.json
- 状态信息的示例和schema：api-status.example.json / api-status.schema.json
- 命令行参数说明.md

## 注意事项
1. 项目在满足targets目录文档的需求以后，不要自行扩充功能！保证项目的简洁！
2. 注意当前使用的nodejs22版本，凡是能使用内置库的，不要使用第三方依赖库！
3. 当前项目根目录内的所有文件你都可以修改，除了.vtxf/ai/prompts文件夹的内容！
4. 严禁修改项目根目录以外的其他任何文件！
5. 必须阅读targets目录所有文件以后再开始搭建项目！


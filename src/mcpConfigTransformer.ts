import { platform } from 'os';
import { Config, SchemaConfig, StdioServerConfig } from './types/ConfigTypes';
import { logger } from './utils/Logger';

/**
 * 转换MCP配置以适配Windows系统
 * 在Windows系统下，为stdio控制台命令添加cmd /c前缀
 *
 * @param config 原始配置对象
 * @returns 转换后的配置对象
 */
export function transformMcpConfigForWindows(config: Config): Config {
  // 检查是否为Windows系统
  if (platform() !== 'win32') {
    // 非Windows系统，直接返回原配置
    return config;
  }

  // Windows系统，需要转换配置
  const transformedConfig: Config = {
    ...config,
    schemas: {}
  };

  // 遍历所有schema配置
  for (const [schemaName, schemaConfig] of Object.entries(config.schemas)) {
    const transformedSchemaConfig: SchemaConfig = {
      ...schemaConfig,
      mcpServers: {}
    };

    // 遍历所有MCP服务器配置
    for (const [serverName, serverConfig] of Object.entries(schemaConfig.mcpServers)) {
      // 只处理stdio类型的服务器配置
      const { type = 'stdio' } = serverConfig
      if (type === 'stdio') {
        const stdioConfig = serverConfig as StdioServerConfig;

        // 检查是否需要转换（通常是需要为npx、node等命令添加前缀）
        const needsTransformation = shouldTransformCommand(stdioConfig.command);

        if (needsTransformation) {
          // 需要转换：在命令前添加cmd /c
          transformedSchemaConfig.mcpServers[serverName] = {
            ...stdioConfig,
            command: 'cmd',
            args: ['/c', stdioConfig.command, ...(stdioConfig.args || [])]
          } as StdioServerConfig;

          logger.info(`已转换Windows MCP服务器配置: ${schemaName}.${serverName}`);
          logger.debug(`原命令: ${stdioConfig.command} ${(stdioConfig.args || []).join(' ')}`);
          logger.debug(`新命令: cmd /c ${stdioConfig.command} ${(stdioConfig.args || []).join(' ')}`);
        } else {
          // 不需要转换，保持原配置
          transformedSchemaConfig.mcpServers[serverName] = serverConfig;
        }
      } else {
        // 非stdio类型，保持原配置
        transformedSchemaConfig.mcpServers[serverName] = serverConfig;
      }
    }

    transformedConfig.schemas[schemaName] = transformedSchemaConfig;
  }

  return transformedConfig;
}

/**
 * 判断命令是否需要转换
 *
 * @param command 命令字符串
 * @returns 是否需要转换
 */
function shouldTransformCommand(command: string): boolean {
  // 定义需要转换的命令列表
  const commandsToTransform = [
    'npx',
    'node',
    'python',
    'python3',
    'pip',
    'pip3',
    'npm',
    'yarn',
    'pnpm'
  ];

  // 检查命令是否在需要转换的列表中
  return commandsToTransform.includes(command);
}

/**
 * 转换MCP配置JSON字符串
 *
 * @param configJson 原始配置JSON字符串
 * @returns 转换后的配置JSON字符串
 */
export function transformMcpConfigJsonForWindows(configJson: string): string {
  try {
    const config: Config = JSON.parse(configJson);
    const transformedConfig = transformMcpConfigForWindows(config);
    return JSON.stringify(transformedConfig, null, 2);
  } catch (error) {
    logger.error('转换MCP配置时发生错误:', error);
    throw new Error(`无效的MCP配置JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 默认导出转换函数
 */
export default {
  transformMcpConfigForWindows,
  transformMcpConfigJsonForWindows
};
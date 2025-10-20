/**
 * 基础功能测试
 * 验证核心模块是否正常工作
 */

const { Logger } = require('./src/utils/Logger.js');
const { ConfigLoader } = require('./src/utils/ConfigLoader.js');

console.log('🧪 开始基础功能测试...\n');

// 测试日志功能
console.log('📝 测试日志功能...');
const logger = Logger.getInstance();
logger.configure({ level: 'info', console: true });

logger.info('测试信息日志');
logger.warn('测试警告日志');
logger.error('测试错误日志');
console.log('✅ 日志功能测试通过\n');

// 测试配置加载功能
console.log('⚙️ 测试配置加载功能...');
const configLoader = ConfigLoader.getInstance();

try {
    const config = configLoader.loadConfig({
        validateSchema: true,
        replaceEnvVars: true
    });

    console.log('✅ 配置加载成功');
    console.log('📊 服务器配置:', {
        port: config.server.port,
        host: config.server.host || '0.0.0.0'
    });
    console.log('🔧 Schemas数量:', Object.keys(config.schemas).length);

    // 显示每个schema的MCP服务器
    for (const [schemaName, schemaConfig] of Object.entries(config.schemas)) {
        const serverCount = Object.keys(schemaConfig.mcpServers).length;
        console.log(`  - ${schemaName}: ${serverCount} 个MCP服务器 (enabled: ${schemaConfig.enabled !== false})`);
    }

} catch (error) {
    console.error('❌ 配置加载失败:', error.message);
}

console.log('\n🎉 基础功能测试完成！');
/**
 * 项目验证脚本
 * 验证项目结构和配置文件
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 项目结构验证\n');

// 检查必需的文件和目录
const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'src/app.ts',
    'src/cli.ts',
    'src/core/JSONRPCHandler.ts',
    'src/core/HTTPServer.ts',
    'src/core/MCPConnectionManager.ts',
    'src/types/MCPTypes.ts',
    'src/types/ConfigTypes.ts',
    'src/utils/Logger.ts',
    'src/utils/ConfigLoader.ts',
    'src/interfaces/IMCPServer.ts',
    'README.md',
    'Dockerfile',
    '.gitignore'
];

const requiredDirs = [
    'src',
    'src/core',
    'src/types',
    'src/utils',
    'src/interfaces',
    'tests',
    'tests/unit',
    'tests/integration',
    'docs',
    'schema'
];

console.log('📁 检查必需文件...');
let missingFiles = 0;
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - 文件缺失`);
        missingFiles++;
    }
});

console.log('\n📂 检查必需目录...');
let missingDirs = 0;
requiredDirs.forEach(dir => {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        console.log(`  ✅ ${dir}/`);
    } else {
        console.log(`  ❌ ${dir}/ - 目录缺失`);
        missingDirs++;
    }
});

// 检查配置文件
console.log('\n🔧 检查配置文件...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`  ✅ package.json - ${packageJson.name} v${packageJson.version}`);

    if (packageJson.scripts && packageJson.scripts.build) {
        console.log(`  ✅ 构建脚本: ${packageJson.scripts.build}`);
    }

    if (packageJson.engines && packageJson.engines.node) {
        console.log(`  ✅ Node.js要求: ${packageJson.engines.node}`);
    }
} catch (error) {
    console.log(`  ❌ package.json - 无法解析: ${error.message}`);
    missingFiles++;
}

try {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    console.log(`  ✅ tsconfig.json - TypeScript ${tsConfig.compilerOptions.target}`);
    console.log(`  ✅ 输出目录: ${tsConfig.compilerOptions.outDir}`);
} catch (error) {
    console.log(`  ❌ tsconfig.json - 无法解析: ${error.message}`);
    missingFiles++;
}

// 检查文档
console.log('\n📚 检查文档文件...');
const docFiles = [
    'docs/configuration.md',
    'docs/api.md',
    'schema/config.schema.json'
];

docFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - 文档缺失`);
        missingFiles++;
    }
});

// 检查源代码文件结构
console.log('\n💻 检查源代码文件结构...');
const coreFiles = fs.readdirSync('src/core');
console.log(`  📦 core/ 目录: ${coreFiles.length} 个文件`);

coreFiles.forEach(file => {
    console.log(`    - ${file}`);
});

// 统计代码行数
console.log('\n📊 代码统计...');
let totalLines = 0;
let totalFiles = 0;

function countLines(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            countLines(fullPath);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n').length;
            totalLines += lines;
            totalFiles++;
        }
    });
}

countLines('src');
console.log(`  📄 TypeScript文件: ${totalFiles} 个`);
console.log(`  📝 总代码行数: ${totalLines} 行`);

// 总结
console.log('\n📋 验证结果:');
if (missingFiles === 0 && missingDirs === 0) {
    console.log('  ✅ 所有必需文件和目录都存在');
    console.log('  ✅ 项目结构完整');
    console.log('\n🎉 项目验证通过！mcps-proxy 已成功搭建。');
    console.log('\n🚀 下一步操作:');
    console.log('  1. 安装依赖: npm install');
    console.log(' 2. 构建项目: npm run build');
    console.log(' 3. 运行测试: npm test');
    console.log(' 4. 启动服务: npm start');
} else {
    console.log(`  ❌ 发现问题: ${missingFiles} 个文件缺失, ${missingDirs} 个目录缺失`);
    console.log('\n🔧 请检查并修复以上问题。');
}
# 使用Node.js 22官方镜像
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcps-proxy -u 1001

# 复制package文件
COPY package*.json ./

# 安装依赖（仅生产依赖）
RUN npm ci --only=production && npm cache clean --force

# 复制构建后的代码
COPY dist ./dist

# 复制配置文件Schema
COPY schema ./schema

# 创建必要的目录并设置权限
RUN mkdir -p /home/mcps-proxy/.mcps-proxy/logs && \
    chown -R mcps-proxy:nodejs /home/mcps-proxy && \
    chown -R mcps-proxy:nodejs /app

# 切换到非root用户
USER mcps-proxy

# 设置环境变量
ENV NODE_ENV=production
ENV MCPS_CONFIG_PATH=/home/mcps-proxy/.mcps-proxy/config.json

# 暴露端口
EXPOSE 3095

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3095/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动应用
CMD ["node", "dist/cli.js"]
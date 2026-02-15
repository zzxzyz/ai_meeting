# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# 安装 pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 只复制生产依赖
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "dist/main.js"]

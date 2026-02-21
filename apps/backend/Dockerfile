# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 安装构建依赖（Python、make、g++ 用于编译原生模块如 bcrypt）
RUN apk add --no-cache python3 py3-setuptools make g++

# 复制根目录的配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY .npmrc* ./

# 复制 packages（共享包）
COPY packages ./packages

# 复制 apps/backend
COPY apps/backend ./apps/backend

# 安装 pnpm
RUN npm install -g pnpm

# 安装所有依赖（包括 workspace 依赖）
RUN pnpm install --frozen-lockfile

# 构建后端（在根目录使用 filter 构建）
RUN pnpm --filter @ai-meeting/backend build

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制根目录配置
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# 复制 packages（共享包）
COPY --from=builder /app/packages ./packages

# 复制 backend 的 package.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

# 切换到 backend 目录
WORKDIR /app/apps/backend

# 安装生产依赖
RUN cd /app && pnpm install --prod --frozen-lockfile

# 从构建阶段复制编译后的代码
COPY --from=builder /app/apps/backend/dist ./dist

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "dist/main.js"]

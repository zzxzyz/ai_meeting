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

# 先构建 shared 包，再在 backend 目录下构建（确保 dist 输出到 apps/backend/dist）
RUN pnpm --filter @ai-meeting/shared build
RUN cd /app/apps/backend && pnpm run build

# 验证构建产物存在，避免运行时 MODULE_NOT_FOUND（Nest 输出为 dist/src/main.js）
RUN test -f /app/apps/backend/dist/src/main.js || (echo "Error: dist/src/main.js not found after build" && ls -la /app/apps/backend/dist/ && exit 1)

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制根目录配置（含 pnpm-workspace.yaml 以便 pnpm 识别 workspace 并安装 backend 依赖）
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# 复制 packages（共享包，backend 依赖 @ai-meeting/shared）
COPY --from=builder /app/packages ./packages

# 复制 backend 的 package.json（workspace 成员需存在以便 pnpm install 安装其依赖）
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

# 安装生产依赖（必须在复制 dist 之前执行，以便生成 node_modules）
RUN cd /app && pnpm install --prod --frozen-lockfile --ignore-scripts

# 切换到 backend 目录
WORKDIR /app/apps/backend

# 从构建阶段复制编译后的代码
COPY --from=builder /app/apps/backend/dist ./dist

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用（使用绝对路径避免 WORKDIR 相关问题）
CMD ["node", "/app/apps/backend/dist/src/main.js"]

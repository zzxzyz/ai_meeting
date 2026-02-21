# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制根目录的配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY .npmrc* ./

# 复制 packages（共享包）
COPY packages ./packages

# 复制 apps/web
COPY apps/web ./apps/web

# 安装 pnpm
RUN npm install -g pnpm

# 安装所有依赖（包括 workspace 依赖）
RUN pnpm install --frozen-lockfile

# 构建前端（在根目录使用 filter 构建）
RUN pnpm --filter @ai-meeting/web build

# 生产阶段 - 使用 Nginx
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

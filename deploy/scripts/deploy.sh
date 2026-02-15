#!/bin/bash

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在项目根目录
if [ ! -f "docker-compose.prod.yml" ]; then
    log_error "请在项目根目录下运行此脚本"
    exit 1
fi

log_info "====================================="
log_info "AI Meeting 部署脚本"
log_info "====================================="

# 1. 检查环境变量文件
if [ ! -f ".env.production" ]; then
    log_error ".env.production 文件不存在"
    log_info "请复制 .env.production.example 为 .env.production 并配置"
    exit 1
fi

log_info "✓ 环境变量文件检查通过"

# 2. 检查 SSL 证书
if [ ! -f "deploy/ssl/cert.pem" ] || [ ! -f "deploy/ssl/key.pem" ]; then
    log_warn "SSL 证书不存在"
    log_info "生成自签名证书中..."
    cd deploy/ssl && ./generate-self-signed-cert.sh && cd ../..
fi

log_info "✓ SSL 证书检查通过"

# 3. 加载环境变量
source .env.production

# 4. 停止旧容器
log_info "停止旧容器..."
docker-compose -f docker-compose.prod.yml down || true

# 5. 清理旧镜像 (可选)
read -p "是否清理旧的 Docker 镜像? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "清理旧镜像..."
    docker-compose -f docker-compose.prod.yml rm -f || true
    docker system prune -f
fi

# 6. 构建镜像
log_info "构建 Docker 镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache

# 7. 启动服务
log_info "启动服务..."
docker-compose -f docker-compose.prod.yml up -d

# 8. 等待服务启动
log_info "等待服务启动..."
sleep 10

# 9. 检查服务状态
log_info "检查服务状态..."
docker-compose -f docker-compose.prod.yml ps

# 10. 运行数据库迁移
log_info "运行数据库迁移..."
docker-compose -f docker-compose.prod.yml exec -T backend npm run migration:run || log_warn "数据库迁移失败或无需迁移"

# 11. 健康检查
log_info "执行健康检查..."
sleep 5

# 检查后端
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log_info "✓ 后端服务健康"
else
    log_error "✗ 后端服务异常"
fi

# 检查前端
if curl -f http://localhost/health > /dev/null 2>&1; then
    log_info "✓ 前端服务健康"
else
    log_error "✗ 前端服务异常"
fi

# 12. 显示日志
log_info "====================================="
log_info "部署完成!"
log_info "====================================="
log_info "访问地址:"
log_info "  - HTTP:  http://YOUR_SERVER_IP"
log_info "  - HTTPS: https://YOUR_SERVER_IP"
log_info ""
log_info "查看日志: docker-compose -f docker-compose.prod.yml logs -f"
log_info "停止服务: docker-compose -f docker-compose.prod.yml down"
log_info "重启服务: docker-compose -f docker-compose.prod.yml restart"
log_info "====================================="

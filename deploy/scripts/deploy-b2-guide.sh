#!/bin/bash

# ============================================
# AI Meeting B-2 方案部署脚本
# 使用子域名 + Nginx 反向代理
# ============================================

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================="
echo "AI Meeting B-2 方案部署"
echo -e "==========================================${NC}"
echo ""

# ============================================
# 第 1 步：配置检查
# ============================================
echo -e "${YELLOW}第 1 步：配置检查${NC}"

# 检查是否在正确的目录
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}错误：请在 /root/ai_meeting 目录下执行此脚本${NC}"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env.production" ]; then
    echo -e "${RED}错误：.env.production 文件不存在${NC}"
    echo "请先执行：cp .env.production.example .env.production"
    echo "并修改其中的配置"
    exit 1
fi

echo -e "${GREEN}✓${NC} 配置文件检查通过"
echo ""

# ============================================
# 第 2 步：询问子域名
# ============================================
echo -e "${YELLOW}第 2 步：配置子域名${NC}"
read -p "请输入您的子域名（例如：meeting.example.com）: " SUBDOMAIN

if [ -z "$SUBDOMAIN" ]; then
    echo -e "${RED}错误：子域名不能为空${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} 子域名：$SUBDOMAIN"
echo ""

# ============================================
# 第 3 步：DNS 检查
# ============================================
echo -e "${YELLOW}第 3 步：检查 DNS 解析${NC}"

if command -v dig &> /dev/null; then
    DNS_IP=$(dig +short "$SUBDOMAIN" | tail -n1)
    if [ -n "$DNS_IP" ]; then
        echo -e "${GREEN}✓${NC} DNS 解析成功：$SUBDOMAIN → $DNS_IP"
    else
        echo -e "${YELLOW}⚠${NC} DNS 未解析或未生效"
        echo "请确保已在域名提供商添加 A 记录"
        read -p "是否继续？(y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ]; then
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} dig 命令不可用，跳过 DNS 检查"
fi
echo ""

# ============================================
# 第 4 步：SSL 证书
# ============================================
echo -e "${YELLOW}第 4 步：SSL 证书配置${NC}"
echo "请选择 SSL 证书类型："
echo "1) Let's Encrypt（推荐，免费自动续期）"
echo "2) 自签名证书（测试用）"
echo "3) 已有证书（跳过证书生成）"
read -p "请选择 [1-3]: " SSL_CHOICE

case $SSL_CHOICE in
    1)
        echo "使用 Let's Encrypt 生成证书..."
        
        # 检查 certbot
        if ! command -v certbot &> /dev/null; then
            echo "安装 certbot..."
            yum install -y certbot python3-certbot-nginx
        fi
        
        # 生成证书
        certbot certonly --nginx -d "$SUBDOMAIN"
        
        SSL_CERT="/etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem"
        SSL_KEY="/etc/letsencrypt/live/$SUBDOMAIN/privkey.pem"
        
        # 配置自动续期
        echo "0 0 1 * * certbot renew --quiet --post-hook 'systemctl reload nginx'" | crontab -
        
        echo -e "${GREEN}✓${NC} Let's Encrypt 证书生成成功"
        ;;
    2)
        echo "生成自签名证书..."
        mkdir -p /root/ai_meeting/deploy/ssl
        cd /root/ai_meeting/deploy/ssl
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout key.pem \
            -out cert.pem \
            -subj "/C=CN/ST=Beijing/L=Beijing/O=Company/CN=$SUBDOMAIN"
        
        chmod 600 key.pem
        
        SSL_CERT="/root/ai_meeting/deploy/ssl/cert.pem"
        SSL_KEY="/root/ai_meeting/deploy/ssl/key.pem"
        
        echo -e "${GREEN}✓${NC} 自签名证书生成成功"
        echo -e "${YELLOW}⚠${NC} 浏览器会提示不安全，需要点击继续访问"
        ;;
    3)
        echo "使用已有证书"
        read -p "请输入证书路径 (cert.pem): " SSL_CERT
        read -p "请输入私钥路径 (key.pem): " SSL_KEY
        
        if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
            echo -e "${RED}错误：证书文件不存在${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓${NC} 使用证书：$SSL_CERT"
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac
echo ""

# ============================================
# 第 5 步：配置系统 Nginx
# ============================================
echo -e "${YELLOW}第 5 步：配置系统 Nginx${NC}"

NGINX_CONF="/etc/nginx/conf.d/ai-meeting.conf"

cat > "$NGINX_CONF" << NGINX_EOF
# ============================================
# AI Meeting 应用 - 子域名配置
# 自动生成于 $(date)
# ============================================

# HTTP 服务器（重定向到 HTTPS）
server {
    listen 80;
    server_name $SUBDOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name $SUBDOMAIN;

    # SSL 证书
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 日志
    access_log /var/log/nginx/ai-meeting-access.log;
    error_log /var/log/nginx/ai-meeting-error.log;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # 代理到 Docker 容器
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket 支持
    location /socket.io/ {
        proxy_pass http://localhost:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
NGINX_EOF

echo -e "${GREEN}✓${NC} Nginx 配置已生成：$NGINX_CONF"

# 测试 Nginx 配置
echo "测试 Nginx 配置..."
if nginx -t; then
    echo -e "${GREEN}✓${NC} Nginx 配置测试通过"
else
    echo -e "${RED}✗${NC} Nginx 配置测试失败"
    exit 1
fi

# 重载 Nginx
echo "重载 Nginx..."
systemctl reload nginx
echo -e "${GREEN}✓${NC} Nginx 重载成功"
echo ""

# ============================================
# 第 6 步：修改 docker-compose.prod.yml
# ============================================
echo -e "${YELLOW}第 6 步：修改 Docker Compose 配置${NC}"

# 备份原配置
cp docker-compose.prod.yml docker-compose.prod.yml.backup

# 修改端口配置（frontend 部分）
sed -i 's/"80:80"/"8080:80"/' docker-compose.prod.yml
sed -i 's/"443:443"/# "443:443"  # 不需要，系统 Nginx 处理 SSL/' docker-compose.prod.yml

echo -e "${GREEN}✓${NC} Docker Compose 配置已修改"
echo -e "${YELLOW}备份${NC}：docker-compose.prod.yml.backup"
echo ""

# ============================================
# 第 7 步：部署 Docker 容器
# ============================================
echo -e "${YELLOW}第 7 步：部署 Docker 容器${NC}"

# 停止旧容器
if docker-compose --env-file .env.production -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "停止旧容器..."
    docker-compose --env-file .env.production -f docker-compose.prod.yml down
fi

# 构建并启动
echo "构建 Docker 镜像..."
docker-compose --env-file .env.production -f docker-compose.prod.yml build --no-cache

echo "启动容器..."
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d

echo "等待服务启动..."
sleep 10

# 运行数据库迁移
echo "运行数据库迁移..."
if docker-compose --env-file .env.production -f docker-compose.prod.yml exec -T backend npm run migration:run 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 数据库迁移成功"
else
    echo -e "${YELLOW}⚠${NC} 数据库迁移可能失败（如果是首次部署可忽略）"
fi

echo -e "${GREEN}✓${NC} Docker 容器部署完成"
echo ""

# ============================================
# 第 8 步：健康检查
# ============================================
echo -e "${YELLOW}第 8 步：健康检查${NC}"

# 检查容器状态
echo "检查容器状态..."
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 检查端口
echo ""
echo "检查端口占用..."
netstat -tlnp | grep -E ":(80|443|8080|3000|5432|6379)"

# 测试本地访问
echo ""
echo "测试本地访问..."
if curl -s http://localhost:8080 > /dev/null; then
    echo -e "${GREEN}✓${NC} Docker 容器 HTTP 可访问"
else
    echo -e "${RED}✗${NC} Docker 容器 HTTP 不可访问"
fi

# 测试 HTTPS（需要等待 DNS 生效）
echo ""
echo "测试 HTTPS 访问..."
sleep 2
if curl -k -s "https://$SUBDOMAIN/api/health" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} HTTPS 访问成功"
else
    echo -e "${YELLOW}⚠${NC} HTTPS 访问失败（可能 DNS 未生效）"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "部署完成！"
echo -e "==========================================${NC}"
echo ""
echo "访问地址："
echo "  https://$SUBDOMAIN"
echo ""
echo "健康检查："
echo "  curl -k https://$SUBDOMAIN/api/health"
echo ""
echo "查看日志："
echo "  docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f"
echo ""
echo "Nginx 日志："
echo "  tail -f /var/log/nginx/ai-meeting-access.log"
echo "  tail -f /var/log/nginx/ai-meeting-error.log"
echo ""

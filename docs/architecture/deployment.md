# 部署方案文档

## 文档信息

- **版本**: v1.0
- **最后更新**: 2026-02-13
- **负责人**: 运维团队
- **适用范围**: v0.1 MVP 版本

## 一、部署概述

### 1.1 部署目标

- 快速部署: 30分钟内完成完整部署
- 易于维护: 标准化配置,自动化运维
- 可扩展: 支持水平扩展
- 高可用: 服务故障自动恢复

### 1.2 部署架构

\`\`\`
                        Internet
                           │
                           ▼
                    ┌──────────────┐
                    │  Cloudflare  │ (CDN + DDoS Protection)
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Nginx/Caddy│ (Reverse Proxy + SSL)
                    └──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        ┌──────────┐              ┌──────────┐
        │   Web    │              │   API    │
        │   App    │              │ Service  │
        └──────────┘              └──────────┘
                                       │
                         ┌─────────────┼─────────────┐
                         │             │             │
                         ▼             ▼             ▼
                  ┌───────────┐ ┌──────────┐ ┌──────────┐
                  │PostgreSQL │ │  Redis   │ │  MinIO   │
                  │           │ │          │ │(Storage) │
                  └───────────┘ └──────────┘ └──────────┘
\`\`\`

## 二、环境要求

### 2.1 硬件要求

**MVP 版本最小配置**:
- **CPU**: 4核
- **内存**: 8GB
- **磁盘**: 100GB SSD
- **网络**: 100Mbps

**推荐配置**:
- **CPU**: 8核
- **内存**: 16GB
- **磁盘**: 200GB SSD
- **网络**: 1Gbps

### 2.2 软件要求

- **操作系统**: Ubuntu 22.04 LTS / CentOS 8+
- **Docker**: 24.0+
- **Docker Compose**: 2.20+
- **Git**: 2.30+

## 三、服务器准备

### 3.1 系统初始化

\`\`\`bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl wget git vim htop net-tools

# 设置时区
sudo timedatectl set-timezone Asia/Shanghai

# 配置防火墙
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
\`\`\`

### 3.2 安装 Docker

\`\`\`bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker
sudo systemctl enable docker
sudo systemctl start docker

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
\`\`\`

## 四、应用部署

### 4.1 目录结构

\`\`\`bash
/opt/ai-meeting/
├── docker-compose.yml
├── .env
├── nginx/
│   └── nginx.conf
├── ssl/
│   ├── fullchain.pem
│   └── privkey.pem
├── data/
│   ├── postgres/
│   ├── redis/
│   └── minio/
└── logs/
    ├── nginx/
    └── app/
\`\`\`

### 4.2 创建部署目录

\`\`\`bash
sudo mkdir -p /opt/ai-meeting/{nginx,ssl,data/{postgres,redis,minio},logs/{nginx,app}}
cd /opt/ai-meeting
\`\`\`

### 4.3 环境变量配置

创建 `.env` 文件:

\`\`\`bash
# Application
NODE_ENV=production
APP_PORT=3000

# Database
DATABASE_URL=postgresql://ai_meeting:CHANGE_ME_DB_PASSWORD@postgres:5432/ai_meeting
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ai_meeting
DB_USER=ai_meeting
DB_PASSWORD=CHANGE_ME_DB_PASSWORD

# Redis
REDIS_URL=redis://:CHANGE_ME_REDIS_PASSWORD@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# JWT
JWT_SECRET=CHANGE_ME_JWT_SECRET_VERY_LONG_RANDOM_STRING
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# MinIO (Object Storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=CHANGE_ME_MINIO_PASSWORD
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=ai-meeting-recordings

# SMTP (邮件)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=turnuser
TURN_PASSWORD=CHANGE_ME_TURN_PASSWORD

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
\`\`\`

**安全提示**:
- 所有 `CHANGE_ME_*` 的值必须修改为强密码
- 不要将 `.env` 文件提交到 Git
- 定期轮换密钥和密码

### 4.4 生成安全密钥

\`\`\`bash
# 生成数据库密码
openssl rand -base64 32

# 生成 JWT Secret
openssl rand -base64 64

# 生成 Redis 密码
openssl rand -base64 32
\`\`\`

### 4.5 Docker Compose 配置

创建 `docker-compose.yml`:

\`\`\`yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:14-alpine
    container_name: ai-meeting-postgres
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - ai-meeting-network

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: ai-meeting-redis
    command: redis-server --requirepass \${REDIS_PASSWORD} --appendonly yes
    volumes:
      - ./data/redis:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - ai-meeting-network

  # MinIO 对象存储
  minio:
    image: minio/minio:latest
    container_name: ai-meeting-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD}
    volumes:
      - ./data/minio:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped
    networks:
      - ai-meeting-network

  # API 服务
  api:
    image: ghcr.io/your-org/ai-meeting/api:latest
    container_name: ai-meeting-api
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./logs/app:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - ai-meeting-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  # Web 前端
  web:
    image: ghcr.io/your-org/ai-meeting/web:latest
    container_name: ai-meeting-web
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - ai-meeting-network

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: ai-meeting-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - api
    restart: unless-stopped
    networks:
      - ai-meeting-network

networks:
  ai-meeting-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  minio-data:
\`\`\`

### 4.6 Nginx 配置

创建 `nginx/nginx.conf`:

\`\`\`nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # HTTP -> HTTPS 重定向
    server {
        listen 80;
        server_name ai-meeting.com www.ai-meeting.com;
        return 301 https://ai-meeting.com$request_uri;
    }

    # HTTPS 主配置
    server {
        listen 443 ssl http2;
        server_name ai-meeting.com;

        # SSL 证书
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000" always;

        # 前端静态文件
        location / {
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API 接口
        location /api/ {
            proxy_pass http://api:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # 超时设置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket 连接
        location /ws/ {
            proxy_pass http://api:3000/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # WebSocket 超时设置
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # 健康检查
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
\`\`\`

## 五、SSL 证书配置

### 5.1 使用 Let's Encrypt (推荐)

\`\`\`bash
# 安装 Certbot
sudo apt install -y certbot

# 获取证书
sudo certbot certonly --standalone -d ai-meeting.com -d www.ai-meeting.com

# 复制证书
sudo cp /etc/letsencrypt/live/ai-meeting.com/fullchain.pem /opt/ai-meeting/ssl/
sudo cp /etc/letsencrypt/live/ai-meeting.com/privkey.pem /opt/ai-meeting/ssl/

# 设置自动续期
sudo crontab -e
# 添加:
0 0 * * * certbot renew --quiet && cp /etc/letsencrypt/live/ai-meeting.com/*.pem /opt/ai-meeting/ssl/ && docker-compose -f /opt/ai-meeting/docker-compose.yml restart nginx
\`\`\`

### 5.2 使用自签名证书 (开发/测试)

\`\`\`bash
cd /opt/ai-meeting/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=AI Meeting/CN=localhost"
\`\`\`

## 六、数据库初始化

创建 `init-db.sql`:

\`\`\`sql
-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表会由应用自动创建,这里只做基础配置
-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建索引函数(如需要)
\`\`\`

## 七、部署执行

### 7.1 首次部署

\`\`\`bash
cd /opt/ai-meeting

# 拉取最新镜像
docker-compose pull

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 等待所有服务健康
docker-compose ps | grep "healthy"
\`\`\`

### 7.2 数据库迁移

\`\`\`bash
# 进入 API 容器执行迁移
docker-compose exec api npm run migration:run

# 或者使用 TypeORM CLI
docker-compose exec api npx typeorm migration:run
\`\`\`

### 7.3 验证部署

\`\`\`bash
# 检查服务健康状态
curl http://localhost/health

# 检查 API
curl http://localhost/api/health

# 检查数据库连接
docker-compose exec api npm run db:check
\`\`\`

## 八、运维操作

### 8.1 服务管理

\`\`\`bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose stop

# 重启服务
docker-compose restart

# 重启单个服务
docker-compose restart api

# 查看日志
docker-compose logs -f api

# 查看资源使用
docker stats
\`\`\`

### 8.2 更新部署

\`\`\`bash
# 拉取最新镜像
docker-compose pull

# 滚动更新
docker-compose up -d --no-deps api

# 验证更新
docker-compose ps
docker-compose logs -f api
\`\`\`

### 8.3 数据备份

\`\`\`bash
# 备份数据库
docker-compose exec postgres pg_dump -U ai_meeting ai_meeting > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份 Redis
docker-compose exec redis redis-cli --rdb /data/dump.rdb

# 备份录制文件
rsync -avz /opt/ai-meeting/data/minio/ /backup/minio/

# 自动化备份脚本
cat > /opt/ai-meeting/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/backup/ai-meeting/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T postgres pg_dump -U ai_meeting ai_meeting | gzip > $BACKUP_DIR/postgres.sql.gz

# 备份配置
cp /opt/ai-meeting/.env $BACKUP_DIR/
cp /opt/ai-meeting/docker-compose.yml $BACKUP_DIR/

# 清理 30 天前的备份
find /backup/ai-meeting/ -type d -mtime +30 -exec rm -rf {} +
EOF

chmod +x /opt/ai-meeting/backup.sh

# 添加到 crontab
0 2 * * * /opt/ai-meeting/backup.sh
\`\`\`

### 8.4 数据恢复

\`\`\`bash
# 恢复数据库
gunzip < backup_20260213_020000.sql.gz | docker-compose exec -T postgres psql -U ai_meeting ai_meeting
\`\`\`

## 九、监控与告警

参考 [监控文档](./monitoring.md) 部署监控系统。

快速部署监控:

\`\`\`bash
# 启动监控服务
docker-compose -f docker-compose.monitoring.yml up -d

# 访问 Grafana
open http://localhost:3002
# 默认用户名/密码: admin/admin
\`\`\`

## 十、故障排查

### 10.1 常见问题

**服务无法启动**:
\`\`\`bash
# 查看日志
docker-compose logs service-name

# 检查端口占用
netstat -tlnp | grep :3000

# 检查磁盘空间
df -h
\`\`\`

**数据库连接失败**:
\`\`\`bash
# 检查数据库状态
docker-compose ps postgres

# 测试连接
docker-compose exec postgres psql -U ai_meeting -d ai_meeting -c "SELECT 1"

# 检查网络
docker network inspect ai-meeting_ai-meeting-network
\`\`\`

**性能问题**:
\`\`\`bash
# 查看资源使用
docker stats

# 查看慢查询
docker-compose exec postgres psql -U ai_meeting -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"
\`\`\`

### 10.2 日志分析

\`\`\`bash
# 查看错误日志
docker-compose logs api | grep ERROR

# 查看最近 100 行
docker-compose logs --tail=100 api

# 实时查看
docker-compose logs -f api
\`\`\`

## 十一、安全加固

### 11.1 系统安全

\`\`\`bash
# 禁用 root 登录
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 配置 fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 自动更新安全补丁
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
\`\`\`

### 11.2 Docker 安全

\`\`\`bash
# 定期更新镜像
docker-compose pull
docker-compose up -d

# 清理未使用的资源
docker system prune -a --volumes -f

# 扫描镜像漏洞 (可选)
docker scan ghcr.io/your-org/ai-meeting/api:latest
\`\`\`

## 十二、性能优化

### 12.1 数据库优化

\`\`\`sql
-- 在 PostgreSQL 中
-- 分析表统计信息
ANALYZE;

-- 创建必要索引
CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_participants_meeting_id ON participants(meeting_id);

-- 配置连接池(在应用中)
-- 最大连接数: 20
-- 最小空闲连接: 5
-- 连接超时: 30s
\`\`\`

### 12.2 Redis 优化

在 `docker-compose.yml` 中添加 Redis 配置:

\`\`\`yaml
redis:
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
\`\`\`

### 12.3 Nginx 优化

已在配置文件中包含基本优化,可根据实际情况调整 `worker_connections`。

## 十三、扩展部署

### 13.1 水平扩展

\`\`\`yaml
# docker-compose.scale.yml
services:
  api:
    deploy:
      replicas: 3
\`\`\`

\`\`\`bash
# 启动多个 API 实例
docker-compose up -d --scale api=3
\`\`\`

### 13.2 负载均衡

在 Nginx 中配置 upstream:

\`\`\`nginx
upstream api_backend {
    least_conn;
    server api:3000 max_fails=3 fail_timeout=30s;
    # 添加更多实例
    # server api2:3000 max_fails=3 fail_timeout=30s;
    # server api3:3000 max_fails=3 fail_timeout=30s;
}

location /api/ {
    proxy_pass http://api_backend/;
    # ...
}
\`\`\`

## 十四、相关文档

- [CI/CD 文档](./cicd.md)
- [监控文档](./monitoring.md)
- [架构设计](./system.md)
- [安全设计](./security.md)

## 十五、快速参考

### 常用命令

\`\`\`bash
# 查看所有服务状态
docker-compose ps

# 重启服务
docker-compose restart [service]

# 查看日志
docker-compose logs -f [service]

# 进入容器
docker-compose exec [service] sh

# 备份数据库
docker-compose exec postgres pg_dump -U ai_meeting ai_meeting > backup.sql

# 更新服务
docker-compose pull && docker-compose up -d
\`\`\`

### 紧急联系

- 运维负责人: [联系方式]
- 技术支持: [联系方式]
- 紧急热线: [联系方式]

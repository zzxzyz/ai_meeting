# B-2 方案部署指南（子域名 + Nginx 反向代理）

## 📋 部署概览

```
用户访问 meeting.example.com
    ↓ :443 (HTTPS)
系统 Nginx (处理 SSL，反向代理)
    ↓ :8080 (HTTP，内网)
Docker Nginx 容器
    ↓
Backend API 服务
```

---

## 🚀 快速部署（推荐）

### 方式 1：使用自动化脚本（最简单）

```bash
# 1. 上传代码到服务器
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  /Users/zhengjunming/Documents/mj_git/ai_meeting \
  root@YOUR_SERVER_IP:/root/

# 2. SSH 登录服务器
ssh root@YOUR_SERVER_IP

# 3. 进入项目目录
cd /root/ai_meeting

# 4. 配置环境变量
cp .env.production.example .env.production
vi .env.production
# 修改：POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
# 注意：VITE_API_URL 改为 https://meeting.example.com

# 5. 上传并执行自动部署脚本
# （脚本已保存在 /tmp/deploy-b2-guide.sh，需要手动上传到服务器）
chmod +x deploy-b2-guide.sh
./deploy-b2-guide.sh

# 脚本会自动：
# - 检查配置
# - 询问子域名
# - 生成/配置 SSL 证书
# - 配置系统 Nginx
# - 修改 docker-compose.prod.yml
# - 部署 Docker 容器
# - 健康检查
```

---

### 方式 2：手动部署（逐步执行）

#### 第 1 步：DNS 配置

在域名提供商添加 A 记录：

```
类型    主机记录    记录值              TTL
A       meeting     YOUR_SERVER_IP      600
```

验证 DNS：
```bash
nslookup meeting.example.com
```

---

#### 第 2 步：生成 SSL 证书

**选项 A：Let's Encrypt（推荐）**

```bash
# 安装 certbot
yum install -y certbot python3-certbot-nginx

# 生成证书
certbot certonly --nginx -d meeting.example.com

# 证书位置：
# /etc/letsencrypt/live/meeting.example.com/fullchain.pem
# /etc/letsencrypt/live/meeting.example.com/privkey.pem

# 配置自动续期
echo "0 0 1 * * certbot renew --quiet --post-hook 'systemctl reload nginx'" | crontab -
```

**选项 B：自签名证书（测试）**

```bash
cd /root/ai_meeting/deploy/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Company/CN=meeting.example.com"

chmod 600 key.pem
```

---

#### 第 3 步：配置系统 Nginx

创建 `/etc/nginx/conf.d/ai-meeting.conf`：

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name meeting.example.com;  # 改成您的子域名
    return 301 https://$server_name$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name meeting.example.com;  # 改成您的子域名

    # SSL 证书（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/meeting.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meeting.example.com/privkey.pem;
    
    # SSL 证书（自签名）
    # ssl_certificate /root/ai_meeting/deploy/ssl/cert.pem;
    # ssl_certificate_key /root/ai_meeting/deploy/ssl/key.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;

    # 日志
    access_log /var/log/nginx/ai-meeting-access.log;
    error_log /var/log/nginx/ai-meeting-error.log;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000" always;

    # 代理到 Docker 容器
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持
    location /socket.io/ {
        proxy_pass http://localhost:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

测试并重载：
```bash
nginx -t
systemctl reload nginx
```

---

#### 第 4 步：修改 docker-compose.prod.yml

编辑 `/root/ai_meeting/docker-compose.prod.yml`：

```yaml
  frontend:
    # ... 其他配置保持不变 ...
    ports:
      - "8080:80"  # 改为 8080，去掉 443 端口
    # 注释掉 volumes 的 SSL 挂载（不需要了）
    # volumes:
    #   - ./deploy/ssl:/etc/nginx/ssl:ro
```

---

#### 第 5 步：配置环境变量

```bash
cd /root/ai_meeting
cp .env.production.example .env.production
vi .env.production
```

**必须修改**：
```bash
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
VITE_API_URL=https://meeting.example.com  # 改成您的子域名
```

---

#### 第 6 步：部署 Docker 容器

```bash
cd /root/ai_meeting

# 停止旧容器（如果有）
docker-compose --env-file .env.production -f docker-compose.prod.yml down

# 构建镜像
docker-compose --env-file .env.production -f docker-compose.prod.yml build --no-cache

# 启动容器
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d

# 运行数据库迁移
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run migration:run
```

---

#### 第 7 步：验证部署

```bash
# 检查容器状态
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 应该看到 4 个容器都是 Up (healthy)

# 测试本地访问
curl http://localhost:8080

# 测试 HTTPS 访问
curl -k https://meeting.example.com/api/health

# 应该返回：
# {"status":"ok","database":"connected","redis":"connected"}
```

---

## 🔍 故障排查

### 问题 1：DNS 未生效

```bash
# 检查 DNS
nslookup meeting.example.com

# 如果未解析，等待 DNS 生效（通常 5-10 分钟）
# 或检查域名提供商的 A 记录配置
```

### 问题 2：SSL 证书错误

```bash
# 检查证书文件
ls -la /etc/letsencrypt/live/meeting.example.com/

# 检查 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 问题 3：无法访问

```bash
# 检查系统 Nginx 是否运行
systemctl status nginx

# 检查端口占用
netstat -tlnp | grep -E ":(80|443|8080)"

# 检查 Docker 容器
docker-compose --env-file .env.production -f docker-compose.prod.yml ps
docker-compose --env-file .env.production -f docker-compose.prod.yml logs frontend

# 测试内网连接
curl http://localhost:8080
```

### 问题 4：WebSocket 连接失败

```bash
# 检查 Nginx 配置中的 WebSocket 部分
cat /etc/nginx/conf.d/ai-meeting.conf | grep -A 10 "socket.io"

# 查看 Nginx 日志
tail -f /var/log/nginx/ai-meeting-error.log
```

---

## 📊 端口使用说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | 系统 Nginx | HTTP，重定向到 HTTPS |
| 443 | 系统 Nginx | HTTPS，对外访问 |
| 8080 | Docker Nginx | 内网 HTTP，不对外开放 |
| 3000 | Backend | 内网，不对外开放 |
| 5432 | PostgreSQL | 内网，不对外开放 |
| 6379 | Redis | 内网，不对外开放 |

**安全说明**：
- 只有 80 和 443 端口对外开放
- 8080、3000、5432、6379 只监听 localhost，不对外开放
- 所有对外流量都经过系统 Nginx 的 SSL 加密

---

## 🛠️ 日常维护

### 查看日志

```bash
# Docker 容器日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f

# 只看后端日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f backend

# Nginx 日志
tail -f /var/log/nginx/ai-meeting-access.log
tail -f /var/log/nginx/ai-meeting-error.log
```

### 重启服务

```bash
# 重启所有 Docker 容器
docker-compose --env-file .env.production -f docker-compose.prod.yml restart

# 重启系统 Nginx
systemctl restart nginx
```

### 更新应用

```bash
# 1. 上传新代码
# 2. 重新构建并部署
cd /root/ai_meeting
docker-compose --env-file .env.production -f docker-compose.prod.yml down
docker-compose --env-file .env.production -f docker-compose.prod.yml build --no-cache
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run migration:run
```

### SSL 证书续期

Let's Encrypt 证书会自动续期（如果配置了 crontab）。

手动续期：
```bash
certbot renew
systemctl reload nginx
```

---

## ✅ 部署成功标志

1. ✅ DNS 解析正确：`nslookup meeting.example.com`
2. ✅ 系统 Nginx 运行：`systemctl status nginx`
3. ✅ 4 个 Docker 容器都是 healthy
4. ✅ HTTPS 访问成功：`https://meeting.example.com`
5. ✅ API 健康检查通过：`https://meeting.example.com/api/health`

---

## 📞 获取帮助

- 详细文档：`deploy/DEPLOYMENT.md`
- 通用部署指南：`deploy/QUICK_START.md`
- 已有 Nginx 方案：`deploy/DEPLOYMENT_WITH_EXISTING_NGINX.md`

---

**创建时间**: 2026-02-15  
**适用场景**: 服务器已有 Nginx，使用子域名部署 AI Meeting 应用  
**推荐度**: ⭐⭐⭐⭐⭐（最优雅的方案）

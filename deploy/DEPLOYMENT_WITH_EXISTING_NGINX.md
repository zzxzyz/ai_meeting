# 服务器已有 Nginx 时的部署方案

## 方案 A：停止已有 Nginx 服务（推荐）

**适用场景**：服务器上的 Nginx 不再需要，或可以暂时停止。

```bash
# 1. 检查 nginx 服务状态
systemctl status nginx

# 2. 停止 nginx 服务
systemctl stop nginx

# 3. 禁止开机自启（可选，防止重启后自动启动）
systemctl disable nginx

# 4. 验证端口已释放
netstat -tlnp | grep -E ":(80|443)"
# 应该看不到任何输出，表示端口已释放

# 5. 然后按照 QUICK_START.md 正常部署
cd /root/ai_meeting/deploy/scripts
./deploy.sh
```

---

## 方案 B：使用 Nginx 反向代理（保留已有 Nginx）

**适用场景**：服务器上的 Nginx 正在服务其他应用，不能停止。

### 方案 B-1：修改 Docker 端口（推荐）

**原理**：Docker 容器使用其他端口（如 8080、8443），已有 Nginx 作为反向代理。

#### 第 1 步：修改 docker-compose.prod.yml

在服务器上修改 `/root/ai_meeting/docker-compose.prod.yml`：

```yaml
  # 前端服务 (Nginx)
  frontend:
    # ... 其他配置保持不变 ...
    ports:
      - "8080:80"    # 原来是 "80:80"
      - "8443:443"   # 原来是 "443:443"
    # ... 其他配置保持不变 ...
```

#### 第 2 步：配置系统 Nginx 反向代理

在服务器上编辑 `/etc/nginx/conf.d/ai-meeting.conf`：

```nginx
# HTTP 服务器（重定向到 HTTPS）
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # 重定向所有 HTTP 请求到 HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN_OR_IP;

    # SSL 证书配置
    ssl_certificate /root/ai_meeting/deploy/ssl/cert.pem;
    ssl_certificate_key /root/ai_meeting/deploy/ssl/key.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/ai-meeting-access.log;
    error_log /var/log/nginx/ai-meeting-error.log;

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
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /socket.io/ {
        proxy_pass http://localhost:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 第 3 步：测试并重载 Nginx

```bash
# 测试配置文件语法
nginx -t

# 如果测试通过，重载 Nginx
systemctl reload nginx

# 或者重启 Nginx
systemctl restart nginx
```

#### 第 4 步：部署 Docker 容器

```bash
cd /root/ai_meeting/deploy/scripts
./deploy.sh
```

#### 第 5 步：验证部署

```bash
# 测试 HTTP（应该重定向到 HTTPS）
curl -I http://YOUR_SERVER_IP

# 测试 HTTPS
curl -k https://YOUR_SERVER_IP/api/health

# 应该返回：
# {"status":"ok","database":"connected","redis":"connected"}
```

---

### 方案 B-2：使用不同域名或子域名

**适用场景**：服务器有多个域名或子域名。

#### 示例配置

```nginx
# 已有应用使用主域名
server {
    listen 80;
    server_name example.com www.example.com;
    # 已有应用的配置...
}

# AI Meeting 使用子域名
server {
    listen 80;
    server_name meeting.example.com;
    
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name meeting.example.com;
    
    ssl_certificate /root/ai_meeting/deploy/ssl/cert.pem;
    ssl_certificate_key /root/ai_meeting/deploy/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        # 其他配置同上...
    }
}
```

---

## 方案 C：直接使用已有 Nginx（不使用 Docker 中的 Nginx）

**原理**：只部署 backend 容器，前端静态文件由系统 Nginx 直接服务。

### 第 1 步：修改 docker-compose.prod.yml

```yaml
services:
  # ... postgres 和 redis 配置保持不变 ...
  
  # 后端服务
  backend:
    # ... 配置保持不变 ...
    ports:
      - "3000:3000"
  
  # 注释掉或删除 frontend 服务
  # frontend:
  #   ...
```

### 第 2 步：构建前端静态文件

在本地机器上：

```bash
cd /Users/zhengjunming/Documents/mj_git/ai_meeting/apps/web
pnpm install
pnpm run build

# 上传构建产物到服务器
rsync -avz dist/ root@YOUR_SERVER_IP:/var/www/ai-meeting/
```

### 第 3 步：配置系统 Nginx

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name YOUR_SERVER_IP;

    ssl_certificate /root/ai_meeting/deploy/ssl/cert.pem;
    ssl_certificate_key /root/ai_meeting/deploy/ssl/key.pem;

    # 前端静态文件
    root /var/www/ai-meeting;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端容器
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 第 4 步：部署后端容器

```bash
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml up -d postgres redis backend
```

---

## 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A: 停止已有 Nginx** | 简单直接，完全按照文档部署 | 需要停止已有服务 | ⭐⭐⭐⭐⭐ |
| **B-1: Nginx 反向代理 + 修改端口** | 保留已有服务，配置清晰 | 需要配置两层 Nginx | ⭐⭐⭐⭐ |
| **B-2: 使用子域名** | 隔离性好，易于管理 | 需要域名和 DNS 配置 | ⭐⭐⭐⭐ |
| **C: 不使用 Docker Nginx** | 完全利用系统 Nginx | 前端需要手动构建和部署 | ⭐⭐⭐ |

---

## 快速决策指南

```
服务器上有 Nginx 在运行吗？
├─ 否 → 按照 QUICK_START.md 正常部署
└─ 是
    ├─ Nginx 还在服务其他应用吗？
    │   ├─ 否 → 方案 A：停止 Nginx
    │   └─ 是
    │       ├─ 有域名吗？
    │       │   ├─ 是 → 方案 B-2：使用子域名
    │       │   └─ 否 → 方案 B-1：修改端口 + 反向代理
    │       └─ 想完全控制 Nginx 配置吗？
    │           └─ 是 → 方案 C：不使用 Docker Nginx
```

---

## 常见问题

### Q1: 如何查看 Nginx 是否在运行？

```bash
systemctl status nginx
# 或
ps aux | grep nginx
# 或
netstat -tlnp | grep -E ":(80|443)"
```

### Q2: 如何查看 Nginx 正在服务哪些应用？

```bash
# 查看 Nginx 配置文件
ls -la /etc/nginx/conf.d/
ls -la /etc/nginx/sites-enabled/

# 查看主配置
cat /etc/nginx/nginx.conf
```

### Q3: 方案 B-1 中，为什么要用 8080 和 8443？

可以使用任何未被占用的端口，例如：
- 8080、8443
- 8888、8889
- 9080、9443

只要确保：
1. 端口未被占用：`netstat -tlnp | grep :8080`
2. docker-compose.yml 和 nginx 配置中的端口一致

### Q4: 如果选择方案 B-1，还需要 Docker 容器中的 SSL 证书吗？

**不需要**。因为：
- 系统 Nginx 处理 SSL/TLS 加密（443 端口）
- Nginx 反向代理到 Docker 容器时使用 HTTP（8080 端口）
- Docker 容器内部不需要配置 SSL

可以修改 docker-compose.prod.yml，去掉 SSL 卷挂载：

```yaml
  frontend:
    # ... 其他配置 ...
    ports:
      - "8080:80"     # 只需要 HTTP 端口
    # volumes:        # 注释掉 SSL 卷挂载
    #   - ./deploy/ssl:/etc/nginx/ssl:ro
```

并修改 `apps/web/nginx.conf`，只保留 HTTP server 块。

### Q5: 如何测试系统 Nginx 的反向代理配置是否正确？

```bash
# 1. 测试配置语法
nginx -t

# 2. 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 3. 查看访问日志
tail -f /var/log/nginx/access.log

# 4. 测试端口连通性
curl -I http://localhost:8080
curl -k https://YOUR_SERVER_IP

# 5. 测试 API 端点
curl -k https://YOUR_SERVER_IP/api/health
```

---

## 总结

**推荐方案**：

1. **首选方案 A**（停止已有 Nginx）
   - 如果服务器上的 Nginx 可以停止

2. **备选方案 B-1**（修改端口 + 反向代理）
   - 如果需要保留已有 Nginx 服务其他应用
   - 最简单的共存方案

3. **特殊场景方案 B-2**（子域名）
   - 如果有域名，推荐使用子域名隔离

选择好方案后，按照对应步骤执行即可。所有方案都经过验证，可以正常工作。

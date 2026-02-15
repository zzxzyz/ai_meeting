# 快速部署指南

## 前置条件确认

在远程 OpenCloudOS 服务器上确认：
```bash
# 检查 Docker 版本
docker --version
docker-compose --version

# 检查 root 权限
sudo -v
```

## 第一步：上传代码到服务器

在**本地机器**上执行：

```bash
# 方法1：使用 rsync (推荐)
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  /path/to/ai_meeting root@YOUR_SERVER_IP:/root/ai_meeting

# 方法2：使用 scp
tar czf ai_meeting.tar.gz --exclude='node_modules' --exclude='dist' --exclude='.git' .
scp ai_meeting.tar.gz root@YOUR_SERVER_IP:/root/
```

如果使用方法2，在服务器上解压：
```bash
ssh root@YOUR_SERVER_IP
cd /root
tar xzf ai_meeting.tar.gz
cd ai_meeting
```

## 第二步：配置环境变量

在**服务器**上执行：

```bash
cd /root/ai_meeting

# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量（重要！）
vi .env.production
```

**必须修改的配置**：

```bash
# 数据库密码（改成强密码）
POSTGRES_PASSWORD=your_strong_password_here

# Redis 密码（改成强密码）
REDIS_PASSWORD=your_redis_password_here

# JWT 密钥（使用以下命令生成）
# openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# 服务器 IP 地址（改成你的服务器 IP）
VITE_API_URL=https://YOUR_SERVER_IP
```

快速生成随机密钥：
```bash
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 16)"
echo "REDIS_PASSWORD=$(openssl rand -base64 16)"
```

## 第三步：生成 SSL 证书

### 选项A：自签名证书（测试用）

```bash
cd /root/ai_meeting/deploy/ssl
chmod +x generate-self-signed-cert.sh
./generate-self-signed-cert.sh
```

访问时浏览器会警告"不安全"，点击"继续访问"即可。

### 选项B：Let's Encrypt 免费证书（生产推荐）

**前提**：必须有域名并解析到服务器 IP

```bash
# 安装 certbot
yum install -y certbot

# 生成证书（替换 yourdomain.com）
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 复制证书到部署目录
mkdir -p /root/ai_meeting/deploy/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /root/ai_meeting/deploy/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /root/ai_meeting/deploy/ssl/key.pem
```

## 第四步：执行一键部署

```bash
cd /root/ai_meeting/deploy/scripts
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动：
1. ✅ 检查环境变量文件
2. ✅ 检查 SSL 证书
3. ✅ 停止旧容器
4. ✅ 构建 Docker 镜像
5. ✅ 启动所有服务
6. ✅ 运行数据库迁移
7. ✅ 健康检查

## 第五步：验证部署

### 检查容器状态

```bash
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml ps
```

应该看到 4 个容器都是 **Up** 状态：
- `ai_meeting_postgres_1` (healthy)
- `ai_meeting_redis_1` (healthy)
- `ai_meeting_backend_1` (healthy)
- `ai_meeting_frontend_1` (healthy)

### 检查日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs

# 查看后端日志
docker-compose -f docker-compose.prod.yml logs backend

# 查看前端日志
docker-compose -f docker-compose.prod.yml logs frontend

# 实时查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 测试访问

```bash
# 测试后端 API
curl -k https://YOUR_SERVER_IP/api/health

# 应该返回：
# {"status":"ok","database":"connected","redis":"connected"}
```

在浏览器访问：
- **前端**: https://YOUR_SERVER_IP
- **后端 API**: https://YOUR_SERVER_IP/api

## 常见问题排查

### 问题1：容器启动失败

```bash
# 查看详细错误
docker-compose -f docker-compose.prod.yml logs backend

# 常见原因：
# - 环境变量配置错误
# - 端口被占用
# - 数据库连接失败
```

### 问题2：数据库连接失败

```bash
# 检查 PostgreSQL 容器
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting -c "\dt"

# 检查环境变量
docker-compose -f docker-compose.prod.yml exec backend env | grep DB_
```

### 问题3：前端无法访问后端

```bash
# 检查 Nginx 配置
docker-compose -f docker-compose.prod.yml exec frontend cat /etc/nginx/conf.d/default.conf

# 检查后端是否可访问
docker-compose -f docker-compose.prod.yml exec frontend wget -O- http://backend:3000/api/health
```

### 问题4：SSL 证书错误

```bash
# 检查证书文件
ls -lh /root/ai_meeting/deploy/ssl/

# 应该有：
# cert.pem (证书)
# key.pem (私钥)
```

## 日常运维命令

### 启动服务

```bash
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml start
```

### 停止服务

```bash
docker-compose -f docker-compose.prod.yml stop
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 只重启后端
docker-compose -f docker-compose.prod.yml restart backend
```

### 更新代码

```bash
# 1. 上传新代码到服务器

# 2. 重新构建并启动
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 3. 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec backend npm run migration:run
```

### 查看资源使用

```bash
docker stats
```

### 数据库备份

```bash
# 备份
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_meeting > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_meeting < backup.sql
```

### 清理

```bash
# 停止并删除所有容器、网络、卷
docker-compose -f docker-compose.prod.yml down -v

# 清理未使用的镜像
docker image prune -a
```

## 防火墙配置

如果服务器有防火墙，需要开放端口：

```bash
# OpenCloudOS 使用 firewalld
systemctl status firewalld

# 开放 HTTP 和 HTTPS 端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# 查看开放的端口
firewall-cmd --list-all
```

## 安全加固建议

1. **修改默认端口**：编辑 `docker-compose.prod.yml`，将 `80:80` 改为 `8080:80`
2. **配置防火墙**：只开放必要的端口
3. **使用强密码**：数据库、Redis 密码至少 16 位
4. **定期备份**：每天自动备份数据库
5. **监控日志**：使用 `docker logs` 监控异常
6. **更新证书**：Let's Encrypt 证书 90 天过期，需自动续期

```bash
# 自动续期 Let's Encrypt 证书
certbot renew --dry-run

# 添加到 crontab（每月检查）
0 0 1 * * certbot renew --post-hook "docker-compose -f /root/ai_meeting/docker-compose.prod.yml restart frontend"
```

## 性能优化建议

1. **调整数据库连接池**：编辑 `apps/backend/src/infrastructure/config/database.config.ts`
2. **启用 Redis 缓存**：确保 Redis 正常运行
3. **Nginx 缓存**：已在 `nginx.conf` 中配置静态资源缓存
4. **监控资源**：使用 `docker stats` 监控 CPU/内存使用

## 完整部署时间轴

```
1. 上传代码 (5-10分钟，取决于网速)
2. 配置环境变量 (2-3分钟)
3. 生成 SSL 证书 (1-2分钟)
4. 执行一键部署 (5-8分钟，首次构建镜像较慢)
---
总计：约 15-20 分钟
```

## 获取帮助

- 详细文档：`/root/ai_meeting/deploy/DEPLOYMENT.md`
- 查看日志：`docker-compose -f docker-compose.prod.yml logs -f`
- 健康检查：`curl -k https://YOUR_SERVER_IP/api/health`

---

**部署成功标志**：
- ✅ 4 个容器都是 healthy 状态
- ✅ 访问 `https://YOUR_SERVER_IP` 可以看到前端页面
- ✅ 访问 `https://YOUR_SERVER_IP/api/health` 返回 `{"status":"ok"}`

Good luck! 🚀

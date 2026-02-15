# 🎉 Docker 部署配置已完成

## ✅ 已创建的部署文件清单

### 📁 核心部署配置

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `docker-compose.prod.yml` | Docker Compose 生产环境配置 | ~4KB |
| `.env.production.example` | 环境变量模板（需复制为 .env.production） | ~1KB |
| `.dockerignore` | Docker 构建忽略文件 | ~0.4KB |

### 📁 后端配置

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `apps/backend/Dockerfile` | 后端 NestJS 应用 Docker 镜像 | ~1KB |

### 📁 前端配置

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `apps/web/Dockerfile` | 前端 React 应用 Docker 镜像 | ~1KB |
| `apps/web/nginx.conf` | Nginx 反向代理和 SSL 配置 | ~3KB |

### 📁 数据库配置

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `deploy/init-db.sql` | PostgreSQL 数据库初始化脚本 | ~1.4KB |

### 📁 SSL 证书

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `deploy/ssl/generate-self-signed-cert.sh` | 自签名证书生成脚本 | ~0.5KB |

### 📁 自动化脚本

| 文件路径 | 说明 | 大小 |
|---------|------|------|
| `deploy/scripts/deploy.sh` | 一键部署脚本 | ~4KB |
| `deploy/scripts/pre-check.sh` | 部署前环境检查脚本（内嵌于文档） | - |

### 📁 部署文档

| 文件路径 | 说明 | 大小 | 用途 |
|---------|------|------|------|
| `deploy/README.md` | 部署目录总览 | ~10KB | 快速导航和命令参考 |
| `deploy/QUICK_START.md` | 快速部署指南 | ~15KB | ⭐ 首次部署推荐 |
| `deploy/DEPLOYMENT.md` | 详细部署文档 | ~20KB | 深入了解部署细节 |
| `deploy/PRE_DEPLOYMENT_CHECKLIST.md` | 部署前检查清单 | ~12KB | 部署前必读 |

---

## 📋 部署准备工作（在远程服务器上执行）

### 第 1 步：上传代码到服务器

**方法 1：使用 rsync（推荐）**

在本地机器上执行：
```bash
rsync -avz \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  /Users/zhengjunming/Documents/mj_git/ai_meeting \
  root@YOUR_SERVER_IP:/root/
```

**方法 2：使用 scp**

在本地机器上执行：
```bash
cd /Users/zhengjunming/Documents/mj_git/ai_meeting
tar czf ai_meeting.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' .
scp ai_meeting.tar.gz root@YOUR_SERVER_IP:/root/
```

然后在服务器上解压：
```bash
ssh root@YOUR_SERVER_IP
cd /root
tar xzf ai_meeting.tar.gz -C ai_meeting
cd ai_meeting
```

---

### 第 2 步：配置环境变量

在服务器上执行：
```bash
cd /root/ai_meeting

# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量
vi .env.production
```

**必须修改的配置项**：
```bash
# 数据库密码（强密码，至少 16 位）
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# Redis 密码（强密码，至少 16 位）
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# JWT 密钥（至少 32 位）
JWT_SECRET=YOUR_JWT_SECRET
JWT_REFRESH_SECRET=YOUR_REFRESH_SECRET

# 服务器 IP 地址
VITE_API_URL=https://YOUR_SERVER_IP
```

**快速生成强密码**：
```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 16)"
echo "REDIS_PASSWORD=$(openssl rand -base64 16)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
```

---

### 第 3 步：生成 SSL 证书

**选项 A：自签名证书（测试用）**

在服务器上执行：
```bash
cd /root/ai_meeting/deploy/ssl
chmod +x generate-self-signed-cert.sh
./generate-self-signed-cert.sh
```

> ⚠️ 浏览器会提示"不安全"，点击"继续访问"即可。

**选项 B：Let's Encrypt 证书（生产环境推荐）**

前提：必须有域名并解析到服务器 IP

```bash
# 安装 certbot
yum install -y certbot

# 生成证书
certbot certonly --standalone -d yourdomain.com

# 复制证书
mkdir -p /root/ai_meeting/deploy/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
   /root/ai_meeting/deploy/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem \
   /root/ai_meeting/deploy/ssl/key.pem
```

---

### 第 4 步：执行部署前检查（可选但推荐）

在服务器上执行：
```bash
cd /root/ai_meeting

# 创建检查脚本
cat > deploy/scripts/pre-check.sh << 'SCRIPT_EOF'
# [查看 deploy/PRE_DEPLOYMENT_CHECKLIST.md 中的脚本内容]
SCRIPT_EOF

# 赋予执行权限
chmod +x deploy/scripts/pre-check.sh

# 执行检查
./deploy/scripts/pre-check.sh
```

---

### 第 5 步：执行一键部署

在服务器上执行：
```bash
cd /root/ai_meeting/deploy/scripts
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动完成以下步骤：
1. ✅ 检查 .env.production 文件
2. ✅ 检查 SSL 证书
3. ✅ 停止旧容器（如果存在）
4. ✅ 构建 Docker 镜像（首次约 5-8 分钟）
5. ✅ 启动所有服务（PostgreSQL、Redis、Backend、Frontend）
6. ✅ 运行数据库迁移
7. ✅ 健康检查

---

## 🎯 部署成功验证

### 1. 检查容器状态

```bash
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml ps
```

应该看到 4 个容器都是 **Up** 状态：
- `ai_meeting_postgres_1` (healthy)
- `ai_meeting_redis_1` (healthy)
- `ai_meeting_backend_1` (healthy)
- `ai_meeting_frontend_1` (healthy)

### 2. 测试后端 API

```bash
curl -k https://YOUR_SERVER_IP/api/health
```

预期输出：
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### 3. 浏览器访问

- **前端应用**: https://YOUR_SERVER_IP
- **后端 API**: https://YOUR_SERVER_IP/api

---

## 🛠️ 常用运维命令

### 查看日志

```bash
cd /root/ai_meeting

# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 只查看后端日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 只查看前端日志
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 只重启后端
docker-compose -f docker-compose.prod.yml restart backend

# 只重启前端
docker-compose -f docker-compose.prod.yml restart frontend
```

### 停止服务

```bash
docker-compose -f docker-compose.prod.yml stop
```

### 启动服务

```bash
docker-compose -f docker-compose.prod.yml start
```

### 完全清理（谨慎使用）

```bash
# 停止并删除所有容器、网络、卷
docker-compose -f docker-compose.prod.yml down -v

# 清理未使用的镜像
docker image prune -a
```

---

## 📊 资源使用预估

| 资源 | 预计使用 | 建议配置 |
|------|---------|---------|
| **CPU** | 2-4 核 | 4 核 |
| **内存** | 2-4 GB | 4 GB |
| **磁盘** | 10-20 GB | 20 GB |
| **带宽** | 10 Mbps | 20 Mbps |

---

## 🔒 安全建议

1. **修改默认密码**: 数据库、Redis、JWT 密钥必须使用强密码
2. **配置防火墙**: 只开放 80 和 443 端口
3. **定期备份**: 每日自动备份数据库
4. **更新证书**: Let's Encrypt 证书 90 天过期，需自动续期
5. **监控日志**: 定期检查异常日志

---

## 📞 需要帮助？

- **查看快速指南**: `cat deploy/QUICK_START.md`
- **查看详细文档**: `cat deploy/DEPLOYMENT.md`
- **查看检查清单**: `cat deploy/PRE_DEPLOYMENT_CHECKLIST.md`
- **查看部署目录说明**: `cat deploy/README.md`
- **查看日志**: `docker-compose -f docker-compose.prod.yml logs -f`
- **健康检查**: `curl -k https://YOUR_SERVER_IP/api/health`

---

## 📝 下一步

部署完成后，可以：

1. **配置域名**（可选）
   - 将域名解析到服务器 IP
   - 修改 `.env.production` 中的 `VITE_API_URL`
   - 使用 Let's Encrypt 生成正式证书

2. **配置自动备份**
   ```bash
   crontab -e
   # 添加每日凌晨 2 点备份
   0 2 * * * cd /root/ai_meeting && docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_meeting > /root/backups/ai_meeting_$(date +\%Y\%m\%d).sql
   ```

3. **配置监控**
   - 使用 `docker stats` 监控资源使用
   - 配置日志收集和分析
   - 设置告警规则

4. **性能优化**
   - 调整数据库连接池
   - 配置 Redis 缓存策略
   - 优化 Nginx 缓存

---

## 🎊 部署成功！

如果所有检查都通过，恭喜您成功部署了 AI Meeting 应用！

```
✅ PostgreSQL 数据库运行中
✅ Redis 缓存运行中
✅ NestJS 后端服务运行中
✅ React 前端应用运行中
✅ Nginx 反向代理配置完成
✅ SSL 证书配置完成
```

**访问应用**: https://YOUR_SERVER_IP

---

**创建时间**: 2026-02-15  
**部署方式**: Docker + Docker Compose  
**支持系统**: OpenCloudOS / CentOS / RHEL

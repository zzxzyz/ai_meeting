# 🚀 AI Meeting 应用部署指南

本目录包含 AI Meeting 应用的生产环境部署配置和脚本。

## 📁 目录结构

```
deploy/
├── README.md                           # 本文件
├── QUICK_START.md                      # 快速部署指南（推荐从这里开始）
├── DEPLOYMENT.md                       # 详细部署文档
├── PRE_DEPLOYMENT_CHECKLIST.md         # 部署前检查清单
├── init-db.sql                         # 数据库初始化脚本
├── scripts/
│   ├── deploy.sh                       # 一键部署脚本
│   └── pre-check.sh                    # 部署前环境检查脚本
└── ssl/
    ├── generate-self-signed-cert.sh    # 自签名证书生成脚本
    ├── cert.pem                        # SSL 证书（执行后生成）
    └── key.pem                         # SSL 私钥（执行后生成）
```

## 📋 部署流程

### 新手推荐流程

1. **阅读快速部署指南**
   ```bash
   cat deploy/QUICK_START.md
   ```

2. **执行部署前检查**
   ```bash
   cd deploy/scripts
   chmod +x pre-check.sh
   ./pre-check.sh
   ```

3. **配置环境变量**
   ```bash
   cp .env.production.example .env.production
   vi .env.production
   # 修改所有 YOUR_*_HERE 占位符
   ```

4. **生成 SSL 证书**
   ```bash
   cd deploy/ssl
   chmod +x generate-self-signed-cert.sh
   ./generate-self-signed-cert.sh
   ```

5. **执行一键部署**
   ```bash
   cd deploy/scripts
   chmod +x deploy.sh
   ./deploy.sh
   ```

### 有经验用户流程

```bash
# 1. 配置环境
cp .env.production.example .env.production && vi .env.production

# 2. 生成证书
cd deploy/ssl && ./generate-self-signed-cert.sh && cd ../..

# 3. 一键部署
cd deploy/scripts && ./deploy.sh
```

## 🔧 核心配置文件

### 根目录文件

| 文件 | 说明 | 位置 |
|------|------|------|
| `docker-compose.prod.yml` | Docker Compose 生产配置 | `/docker-compose.prod.yml` |
| `.env.production.example` | 环境变量模板 | `/.env.production.example` |
| `.env.production` | 实际环境变量（需自行创建） | `/.env.production` |
| `.dockerignore` | Docker 构建忽略文件 | `/.dockerignore` |

### 应用 Dockerfile

| 文件 | 说明 | 位置 |
|------|------|------|
| Backend Dockerfile | 后端服务构建配置 | `/apps/backend/Dockerfile` |
| Frontend Dockerfile | 前端服务构建配置 | `/apps/web/Dockerfile` |
| Nginx 配置 | 前端 Nginx 反向代理配置 | `/apps/web/nginx.conf` |

## 📖 文档说明

### QUICK_START.md
**适用场景**: 首次部署，希望快速上手  
**内容**:
- 5 步快速部署流程
- 每步的详细命令
- 常见问题排查
- 日常运维命令

**推荐阅读顺序**: ⭐ 第一个阅读

### DEPLOYMENT.md
**适用场景**: 需要深入了解部署细节  
**内容**:
- 完整的架构说明
- 详细的配置说明
- 高级配置选项
- 性能优化建议
- 安全加固方案
- 监控和备份策略

**推荐阅读顺序**: 第二个阅读

### PRE_DEPLOYMENT_CHECKLIST.md
**适用场景**: 部署前确保环境准备就绪  
**内容**:
- 逐项检查清单
- 环境验证命令
- 一键检查脚本

**推荐阅读顺序**: 部署前必读

## 🔒 安全要求

### 必须修改的配置

在 `.env.production` 中，以下配置**必须**修改：

```bash
# ❌ 默认值（不安全）
POSTGRES_PASSWORD=changeme
REDIS_PASSWORD=changeme
JWT_SECRET=your_jwt_secret_here

# ✅ 强密码（安全）
POSTGRES_PASSWORD=Xy9#mK2$pLq8@vNz
REDIS_PASSWORD=Rz7&hJ4!wBn3%cMx
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 生成随机密码

```bash
# 生成数据库密码
openssl rand -base64 16

# 生成 JWT 密钥
openssl rand -base64 32
```

## 🌐 访问应用

部署成功后，通过以下地址访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端应用 | `https://YOUR_SERVER_IP` | 用户界面 |
| 后端 API | `https://YOUR_SERVER_IP/api` | RESTful API |
| 健康检查 | `https://YOUR_SERVER_IP/api/health` | 服务状态 |
| WebSocket | `wss://YOUR_SERVER_IP/socket.io` | 实时通信 |

## 🐳 Docker 服务

部署启动以下 4 个容器：

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| PostgreSQL | `ai_meeting_postgres_1` | 5432 | 关系型数据库 |
| Redis | `ai_meeting_redis_1` | 6379 | 缓存和会话存储 |
| Backend | `ai_meeting_backend_1` | 3000 | NestJS 后端服务 |
| Frontend | `ai_meeting_frontend_1` | 80, 443 | Nginx + React 前端 |

## 🛠️ 常用命令

### 查看服务状态

```bash
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml ps
```

### 查看日志

```bash
# 所有服务
docker-compose -f docker-compose.prod.yml logs -f

# 只看后端
docker-compose -f docker-compose.prod.yml logs -f backend

# 只看前端
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 只重启后端
docker-compose -f docker-compose.prod.yml restart backend
```

### 停止服务

```bash
docker-compose -f docker-compose.prod.yml stop
```

### 启动服务

```bash
docker-compose -f docker-compose.prod.yml start
```

### 完全清理

```bash
# 停止并删除所有容器、网络、卷
docker-compose -f docker-compose.prod.yml down -v

# 清理未使用的镜像
docker image prune -a
```

## 🔍 健康检查

### 快速检查

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

### 详细检查

```bash
# 检查所有容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' ai_meeting_backend_1
docker inspect --format='{{.State.Health.Status}}' ai_meeting_postgres_1
docker inspect --format='{{.State.Health.Status}}' ai_meeting_redis_1
```

## 📊 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h

# 查看内存使用
free -h
```

## 🔄 更新应用

```bash
# 1. 上传新代码到服务器

# 2. 停止服务
cd /root/ai_meeting
docker-compose -f docker-compose.prod.yml down

# 3. 重新构建
docker-compose -f docker-compose.prod.yml build --no-cache

# 4. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 5. 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec backend npm run migration:run

# 6. 验证
curl -k https://YOUR_SERVER_IP/api/health
```

## 💾 数据备份

### 备份数据库

```bash
# 备份到文件
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres ai_meeting > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份所有数据库
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dumpall -U postgres > backup_all_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
# 恢复单个数据库
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres ai_meeting < backup.sql

# 恢复所有数据库
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres < backup_all.sql
```

### 自动备份

添加到 crontab：

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 2 点备份
0 2 * * * cd /root/ai_meeting && docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_meeting > /root/backups/ai_meeting_$(date +\%Y\%m\%d).sql
```

## 🆘 故障排查

### 问题：容器启动失败

```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs backend

# 检查配置文件语法
docker-compose -f docker-compose.prod.yml config
```

### 问题：数据库连接失败

```bash
# 进入数据库容器
docker-compose -f docker-compose.prod.yml exec postgres bash

# 测试连接
psql -U postgres -d ai_meeting -c "\dt"

# 检查环境变量
docker-compose -f docker-compose.prod.yml exec backend env | grep DB_
```

### 问题：前端无法访问后端

```bash
# 检查 Nginx 配置
docker-compose -f docker-compose.prod.yml exec frontend \
  cat /etc/nginx/conf.d/default.conf

# 测试后端连接
docker-compose -f docker-compose.prod.yml exec frontend \
  wget -O- http://backend:3000/api/health
```

### 问题：端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep -E ":(80|443|5432|6379)"

# 停止占用端口的服务
systemctl stop <service_name>

# 或修改 docker-compose.prod.yml 中的端口映射
```

## 📞 获取帮助

1. **查看日志**: `docker-compose -f docker-compose.prod.yml logs -f`
2. **阅读详细文档**: `deploy/DEPLOYMENT.md`
3. **检查环境**: `deploy/scripts/pre-check.sh`
4. **健康检查**: `curl -k https://YOUR_SERVER_IP/api/health`

## 🎯 快速链接

- [快速开始](QUICK_START.md) - 5步快速部署
- [详细文档](DEPLOYMENT.md) - 完整部署指南
- [检查清单](PRE_DEPLOYMENT_CHECKLIST.md) - 部署前必读
- [一键部署](scripts/deploy.sh) - 自动化部署脚本
- [环境检查](scripts/pre-check.sh) - 自动化检查脚本

## 📝 版本信息

- **创建日期**: 2026-02-15
- **部署方式**: Docker + Docker Compose
- **支持系统**: OpenCloudOS (兼容 CentOS/RHEL)
- **Node.js**: 18-alpine
- **PostgreSQL**: 15-alpine
- **Redis**: 7-alpine
- **Nginx**: alpine

---

**准备好了吗？开始部署吧！** 🚀

```bash
# 第一步：阅读快速指南
cat deploy/QUICK_START.md

# 第二步：执行部署
cd deploy/scripts && ./deploy.sh
```

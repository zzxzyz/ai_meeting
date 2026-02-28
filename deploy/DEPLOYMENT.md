# AI Meeting 部署指南

## 📋 前置要求

### 服务器要求
- **操作系统**: OpenCloudOS (或其他 Linux 发行版)
- **CPU**: 2核 或以上
- **内存**: 4GB 或以上
- **磁盘**: 20GB 或以上
- **Docker**: 20.10+ 版本
- **Docker Compose**: 2.0+ 版本

### 网络要求
- 开放端口: 80 (HTTP), 443 (HTTPS), 3000 (后端 API，可选)
- 确保防火墙已放行这些端口

---

## 🚀 快速部署

### 1. 准备工作

#### 1.1 上传代码到服务器

```bash
# 在本地机器上，将代码打包
cd /path/to/ai_meeting
tar -czf ai-meeting.tar.gz --exclude='node_modules' --exclude='dist' --exclude='.git' .

# 上传到服务器
scp ai-meeting.tar.gz root@YOUR_SERVER_IP:/opt/

# 在服务器上解压
ssh root@YOUR_SERVER_IP
cd /opt
tar -xzf ai-meeting.tar.gz
mv /opt/ai_meeting /opt/ai-meeting  # 重命名为合适的目录名
cd /opt/ai-meeting
```

#### 1.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量
vi .env.production
```

**必须修改的配置项**:
```bash
# 数据库密码
POSTGRES_PASSWORD=your_strong_password_here

# Redis 密码  
REDIS_PASSWORD=your_redis_password_here

# JWT 密钥 (使用强随机字符串)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# API 地址 (改为您的服务器 IP 或域名)
VITE_API_URL=https://YOUR_SERVER_IP
```

#### 1.3 生成 SSL 证书

**选项 A: 使用自签名证书 (测试/开发)**
```bash
cd deploy/ssl
./generate-self-signed-cert.sh
# 记得修改脚本中的 COMMON_NAME 为您的 IP 地址
```

**选项 B: 使用 Let's Encrypt (生产环境推荐)**
```bash
# 安装 certbot
yum install -y certbot

# 生成证书 (需要域名)
certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/ssl/key.pem
```

**选项 C: 使用已有证书**
```bash
# 将证书文件复制到 deploy/ssl/ 目录
cp your-cert.pem deploy/ssl/cert.pem
cp your-key.pem deploy/ssl/key.pem
```

---

### 2. 执行部署

```bash
# 确保在项目根目录
cd /opt/ai-meeting

# 执行一键部署脚本
bash deploy/scripts/deploy.sh
```

部署脚本会自动完成以下步骤:
1. ✅ 检查环境变量文件
2. ✅ 检查 SSL 证书
3. ✅ 停止旧容器
4. ✅ 构建 Docker 镜像
5. ✅ 启动所有服务
6. ✅ 运行数据库迁移
7. ✅ 健康检查

---

### 3. 验证部署

#### 3.1 检查服务状态

```bash
# 查看所有容器状态
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 应该看到以下容器运行中:
# - ai-meeting-postgres (PostgreSQL)
# - ai-meeting-redis (Redis)
# - ai-meeting-backend (后端 API)
# - ai-meeting-frontend (前端 Nginx)
```

#### 3.2 查看日志

```bash
# 查看所有服务日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
```

#### 3.3 健康检查

```bash
# 检查后端 API
curl http://localhost:3000/health

# 检查前端
curl http://localhost/health

# 如果返回 "healthy" 则表示服务正常
```

#### 3.4 访问应用

在浏览器中访问:
- **HTTP**: `http://YOUR_SERVER_IP`
- **HTTPS**: `https://YOUR_SERVER_IP`

> 注意: 如果使用自签名证书，浏览器会显示安全警告，点击"继续访问"即可

---

## 🔧 常用操作

### 启动服务
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 停止服务
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml down
```

### 重启服务
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml restart
```

### 重启单个服务
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml restart backend
docker-compose --env-file .env.production -f docker-compose.prod.yml restart frontend
```

### 查看日志
```bash
# 实时查看所有日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f

# 查看最近 100 行日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100

# 查看特定服务日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

### 进入容器
```bash
# 进入后端容器
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend sh

# 进入数据库容器
docker-compose --env-file .env.production -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting
```

### 数据库操作
```bash
# 运行迁移
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run migration:run

# 回滚迁移
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run migration:revert

# 数据库备份
docker-compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_meeting > backup_$(date +%Y%m%d_%H%M%S).sql

# 数据库恢复
docker-compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_meeting < backup.sql
```

### 更新应用
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose --env-file .env.production -f docker-compose.prod.yml build --no-cache

# 3. 重启服务
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d

# 4. 运行数据库迁移
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run migration:run
```

### 清理
```bash
# 停止并删除容器、网络
docker-compose --env-file .env.production -f docker-compose.prod.yml down

# 同时删除数据卷 (⚠️ 会丢失数据)
docker-compose --env-file .env.production -f docker-compose.prod.yml down -v

# 清理未使用的 Docker 资源
docker system prune -a
```

---

## 🔒 安全加固

### 1. 修改默认端口
编辑 `docker-compose.prod.yml`，修改端口映射:
```yaml
ports:
  - "8080:80"    # HTTP 改为 8080
  - "8443:443"   # HTTPS 改为 8443
```

### 2. 配置防火墙
```bash
# CentOS/OpenCloudOS (firewalld)
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload

# Ubuntu (ufw)
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3. 限制数据库访问
编辑 `docker-compose.prod.yml`，注释掉数据库端口暴露:
```yaml
postgres:
  # ports:
  #   - "5432:5432"  # 注释掉，只允许内部访问
```

### 4. 使用强密码
```bash
# 生成强随机密码
openssl rand -base64 32

# 更新 .env.production 中的所有密码
```

### 5. 定期更新
```bash
# 更新 Docker 镜像
docker-compose --env-file .env.production -f docker-compose.prod.yml pull
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## 📊 监控和维护

### 查看资源使用
```bash
# 查看容器资源使用情况
docker stats

# 查看磁盘使用
df -h
du -sh /var/lib/docker
```

### 日志管理
```bash
# 限制日志大小 (编辑 docker-compose.prod.yml)
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 定期备份
创建自动备份脚本:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 数据库备份
docker-compose -f /opt/ai-meeting/docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres ai_meeting > $BACKUP_DIR/db_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/db_$DATE.sql

# 删除 7 天前的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

设置定时任务:
```bash
# 每天凌晨 2 点执行备份
crontab -e
0 2 * * * /opt/ai-meeting/deploy/scripts/backup.sh
```

---

## ❓ 故障排查

### 问题 1: 容器无法启动
```bash
# 查看容器日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs backend

# 检查端口占用
netstat -tlnp | grep :3000
```

### 问题 2: 数据库连接失败
```bash
# 检查数据库容器状态
docker-compose --env-file .env.production -f docker-compose.prod.yml ps postgres

# 检查数据库健康状态
docker-compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_isready

# 测试数据库连接
docker-compose --env-file .env.production -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting -c "SELECT 1"
```

### 问题 3: 前端无法访问后端
```bash
# 检查 Nginx 配置
docker-compose --env-file .env.production -f docker-compose.prod.yml exec frontend nginx -t

# 查看 Nginx 日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs frontend
```

### 问题 4: SSL 证书问题
```bash
# 检查证书文件
ls -l deploy/ssl/

# 测试 HTTPS 访问
curl -k https://localhost/health

# 查看证书信息
openssl x509 -in deploy/ssl/cert.pem -text -noout
```

---

## 📞 支持

如遇到问题，请提供以下信息:
1. 错误日志: `docker-compose --env-file .env.production -f docker-compose.prod.yml logs`
2. 容器状态: `docker-compose --env-file .env.production -f docker-compose.prod.yml ps`
3. 系统信息: `uname -a && docker version`

---

## 📝 更新日志

- **2026-02-15**: 初始版本，支持 Docker 部署

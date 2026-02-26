# REQ-003 生产环境部署指南

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话
- **文档类型**: 生产环境部署指南
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: devops-leader
- **状态**: 就绪

---

## 部署前提条件

### 1. 服务器要求

| 资源 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2核 | 4核 |
| 内存 | 4GB | 8GB |
| 磁盘 | 20GB | 50GB |
| 操作系统 | OpenCloudOS 8+ / Ubuntu 20.04+ | CentOS 8+ |

### 2. 软件依赖

```bash
# 必需软件包
Docker 20.10+
Docker Compose 2.0+
Node.js 18+
PostgreSQL 15+
Redis 7+

# 网络要求
开放端口: 80 (HTTP), 443 (HTTPS), 3000 (后端API), 40000-49999/udp (RTP媒体流)
```

---

## 部署步骤

### 步骤 1: 环境准备

#### 1.1 安装 Docker 和 Docker Compose

**CentOS/OpenCloudOS:**
```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Ubuntu:**
```bash
# 安装 Docker
sudo apt update
sudo apt install -y docker.io

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 1.2 配置防火墙

```bash
# 开放必需端口
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=40000-49999/udp
sudo firewall-cmd --reload
```

### 步骤 2: 代码部署

#### 2.1 上传代码到服务器

```bash
# 在本地打包代码
cd /Users/zhengjunming/Documents/mj_git/ai_meeting
tar -czf ai-meeting.tar.gz --exclude='node_modules' --exclude='dist' --exclude='.git' .

# 上传到服务器
scp ai-meeting.tar.gz root@YOUR_SERVER_IP:/opt/

# 在服务器上解压
ssh root@YOUR_SERVER_IP
cd /opt
tar -xzf ai-meeting.tar.gz
mv ai_meeting ai-meeting
cd ai-meeting
```

#### 2.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量
vi .env.production
```

**必需的环境变量配置:**
```bash
# 数据库配置
POSTGRES_PASSWORD=your_strong_password_here
REDIS_PASSWORD=your_redis_password_here

# JWT 密钥
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# API 地址
VITE_API_BASE_URL=https://YOUR_SERVER_DOMAIN/api/v1

# mediasoup 配置（关键）
MEDIASOUP_WORKER_NUM=2
MEDIASOUP_LOG_LEVEL=warn
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999
MEDIASOUP_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
MEDIASOUP_ANNOUNCED_IP=YOUR_SERVER_PUBLIC_IP

# 可选 TURN 服务器配置
MEDIASOUP_TURN_SERVER=turn:turn.example.com:3478
MEDIASOUP_TURN_USERNAME=your_turn_username
MEDIASOUP_TURN_PASSWORD=your_turn_password
```

**重要**: `MEDIASOUP_ANNOUNCED_IP` 必须设置为服务器的公网 IP 地址。

### 步骤 3: SSL 证书配置

#### 3.1 使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo yum install -y certbot

# 生成证书（需要域名）
certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/ssl/key.pem
```

#### 3.2 使用自签名证书（测试环境）

```bash
cd deploy/ssl
./generate-self-signed-cert.sh
```

### 步骤 4: 构建和启动服务

#### 4.1 构建 Docker 镜像

```bash
# 构建后端镜像
docker-compose -f docker-compose.prod.yml build backend

# 构建前端镜像
docker-compose -f docker-compose.prod.yml build frontend
```

#### 4.2 启动所有服务

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 检查服务状态
docker-compose -f docker-compose.prod.yml ps
```

### 步骤 5: 验证部署

#### 5.1 健康检查

```bash
# 检查后端 API
curl http://localhost:3000/api/v1/health

# 检查前端
curl http://localhost/health

# 检查容器状态
docker-compose -f docker-compose.prod.yml ps
```

#### 5.2 音视频功能验证

```bash
# 检查 UDP 端口监听
netstat -tlnp | grep :40000

# 检查 mediasoup Worker 状态
docker-compose -f docker-compose.prod.yml logs backend | grep -i mediasoup
```

---

## 多端互通验证

### Web 端验证

1. **访问应用**: `https://your-domain.com`
2. **登录系统**: 使用测试账号登录
3. **创建会议**: 点击"创建会议"按钮
4. **音视频测试**:
   - 允许摄像头/麦克风权限
   - 验证本地视频预览正常
   - 验证音频设备检测正常

### 多浏览器兼容性测试

| 浏览器组合 | 测试要点 |
|-----------|---------|
| Chrome ↔ Chrome | 双向音视频通话 |
| Chrome ↔ Safari | 跨浏览器兼容性 |
| Chrome ↔ Firefox | 编码器兼容性 |
| Web ↔ Electron | 桌面端互通 |

### 性能指标验证

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 端到端延迟 | < 300ms | WebRTC stats API |
| 连接建立时间 | < 3s | 从点击"加入"到视频显示 |
| 视频分辨率 | 720p@30fps | 网络良好时稳定输出 |
| 4人通话稳定性 | CPU < 80% | 监控系统资源使用 |

---

## 监控和维护

### 1. 资源监控

```bash
# 实时监控容器资源
docker stats

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 检查磁盘使用
df -h
du -sh /var/lib/docker
```

### 2. 性能监控指标

| 指标 | 监控方法 | 告警阈值 |
|------|---------|---------|
| CPU 使用率 | `docker stats` | > 80% |
| 内存使用率 | `docker stats` | > 90% |
| 网络带宽 | `iftop` / `nethogs` | 持续高负载 |
| 容器重启次数 | `docker-compose ps` | 频繁重启 |

### 3. 日志管理

```bash
# 配置日志轮转
sudo mkdir -p /etc/docker/
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# 重启 Docker
sudo systemctl restart docker
```

---

## 故障排查

### 常见问题及解决方案

#### 问题 1: mediasoup Worker 启动失败

**症状**: 后端日志显示 `mediasoup Worker died`

**解决方案**:
```bash
# 检查系统资源
docker stats

# 增加 Worker 数量
export MEDIASOUP_WORKER_NUM=2
docker-compose -f docker-compose.prod.yml up -d backend
```

#### 问题 2: WebRTC 连接失败

**症状**: 客户端无法建立音视频连接

**解决方案**:
```bash
# 检查 MEDIASOUP_ANNOUNCED_IP 配置
echo $MEDIASOUP_ANNOUNCED_IP

# 检查 UDP 端口是否开放
netstat -tlnp | grep :40000

# 验证 STUN 服务器连通性
curl -v stun:stun.l.google.com:19302
```

#### 问题 3: 前端构建失败

**症状**: 前端构建时提示依赖错误

**解决方案**:
```bash
# 重新安装前端依赖
cd apps/web && rm -rf node_modules && pnpm install

# 重新构建前端
docker-compose -f docker-compose.prod.yml build frontend --no-cache
```

#### 问题 4: UDP 端口冲突

**症状**: 容器启动失败，提示端口已被占用

**解决方案**:
```bash
# 检查端口占用
netstat -tlnp | grep :40000

# 修改端口范围
export MEDIASOUP_RTC_MIN_PORT=50000
export MEDIASOUP_RTC_MAX_PORT=59999

# 重新启动
docker-compose -f docker-compose.prod.yml up -d backend
```

---

## 备份和恢复

### 1. 数据库备份

```bash
# 创建备份脚本
cat > /opt/ai-meeting/deploy/scripts/backup.sh << 'EOF'
#!/bin/bash
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
EOF

chmod +x /opt/ai-meeting/deploy/scripts/backup.sh
```

### 2. 定时备份

```bash
# 设置定时任务（每天凌晨 2 点执行备份）
crontab -e
0 2 * * * /opt/ai-meeting/deploy/scripts/backup.sh
```

### 3. 数据恢复

```bash
# 恢复数据库备份
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres ai_meeting < /opt/backups/db_20260226_020000.sql
```

---

## 安全加固

### 1. 修改默认端口

```yaml
# 编辑 docker-compose.prod.yml，修改端口映射
ports:
  - "8080:80"    # HTTP 改为 8080
  - "8443:443"   # HTTPS 改为 8443
```

### 2. 限制数据库访问

```yaml
# 编辑 docker-compose.prod.yml，注释掉数据库端口暴露
postgres:
  # ports:
  #   - "5432:5432"  # 注释掉，只允许内部访问
```

### 3. 使用强密码

```bash
# 生成强随机密码
openssl rand -base64 32

# 更新 .env.production 中的所有密码
```

---

## 更新和升级

### 1. 小版本更新

```bash
# 拉取最新代码
cd /opt/ai-meeting
git pull origin main

# 重新构建镜像
docker-compose -f docker-compose.prod.yml build --no-cache backend frontend

# 重启服务
docker-compose -f docker-compose.prod.yml up -d
```

### 2. 大版本升级

```bash
# 备份数据
/opt/ai-meeting/deploy/scripts/backup.sh

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 更新代码
git pull origin main

# 检查数据库迁移
cd apps/backend && pnpm run migration:run

# 重新构建和启动
docker-compose -f docker-compose.prod.yml up -d
```

---

## 联系支持

如遇到问题，请提供以下信息：

1. **错误日志**: `docker-compose -f docker-compose.prod.yml logs`
2. **容器状态**: `docker-compose -f docker-compose.prod.yml ps`
3. **系统信息**: `uname -a && docker version`
4. **网络状态**: `netstat -tlnp`

**支持联系人**: devops-leader

---

**文档版本**: v1.0
**最后更新**: 2026-02-26
**状态**: ✅ 部署就绪
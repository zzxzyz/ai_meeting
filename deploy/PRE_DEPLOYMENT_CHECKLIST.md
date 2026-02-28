# 部署前检查清单

在执行部署之前，请逐项确认以下内容：

## ✅ 服务器环境检查

- [ ] 操作系统：OpenCloudOS
- [ ] Docker 已安装并运行：`docker --version && docker ps`
- [ ] Docker Compose 已安装：`docker-compose --version`
- [ ] 有 root 权限：`sudo -v`
- [ ] 服务器 IP 地址已知：`ip addr show`
- [ ] 防火墙状态确认：`systemctl status firewalld`

## ✅ 网络和端口检查

- [ ] 80 端口未被占用：`netstat -tlnp | grep :80`
- [ ] 443 端口未被占用：`netstat -tlnp | grep :443`
- [ ] 5432 端口可用（PostgreSQL）：`netstat -tlnp | grep :5432`
- [ ] 6379 端口可用（Redis）：`netstat -tlnp | grep :6379`
- [ ] 如果有防火墙，已开放 80 和 443 端口

## ✅ 磁盘空间检查

- [ ] 根分区至少有 10GB 可用空间：`df -h /`
- [ ] Docker 数据目录有足够空间：`df -h /var/lib/docker`

```bash
# 检查磁盘空间
df -h

# 预计空间使用：
# - Docker 镜像：约 2GB
# - PostgreSQL 数据：约 500MB（初始）
# - 日志文件：约 100MB
# - 总计建议：至少 10GB 可用空间
```

## ✅ 代码准备检查

- [ ] 已将代码上传到服务器 `/root/ai_meeting` 目录
- [ ] `apps/backend/Dockerfile` 文件存在
- [ ] `apps/web/Dockerfile` 文件存在
- [ ] `docker-compose.prod.yml` 文件存在
- [ ] `.env.production.example` 文件存在
- [ ] `deploy/scripts/deploy.sh` 文件存在

```bash
# 快速验证文件结构
cd /root/ai_meeting
ls -l apps/backend/Dockerfile apps/web/Dockerfile docker-compose.prod.yml .env.production.example deploy/scripts/deploy.sh
```

## ✅ 环境变量配置检查

- [ ] 已复制 `.env.production.example` 为 `.env.production`
- [ ] `POSTGRES_PASSWORD` 已修改为强密码（至少 16 位）
- [ ] `REDIS_PASSWORD` 已修改为强密码（至少 16 位）
- [ ] `JWT_SECRET` 已生成（32 字符以上）
- [ ] `JWT_REFRESH_SECRET` 已生成（32 字符以上）
- [ ] `VITE_API_URL` 已修改为服务器 IP 地址
- [ ] 所有 `changeme` 或 `YOUR_*_HERE` 占位符已替换

```bash
# 检查环境变量文件
cat /root/ai_meeting/.env.production | grep -E "POSTGRES_PASSWORD|REDIS_PASSWORD|JWT_SECRET|VITE_API_URL"

# 不应该看到：
# - changeme
# - YOUR_*_HERE
# - password
# - 123456
```

## ✅ SSL 证书检查

- [ ] 已生成或准备好 SSL 证书
- [ ] `deploy/ssl/cert.pem` 文件存在
- [ ] `deploy/ssl/key.pem` 文件存在
- [ ] 证书文件权限正确（600 或 644）

```bash
# 检查证书文件
ls -lh /root/ai_meeting/deploy/ssl/
# 应该看到 cert.pem 和 key.pem

# 如果使用自签名证书
cd /root/ai_meeting/deploy/ssl
./generate-self-signed-cert.sh

# 验证证书
openssl x509 -in cert.pem -text -noout | grep -E "Subject:|Not After"
```

## ✅ 数据库配置检查

- [ ] `deploy/init-db.sql` 文件存在
- [ ] 确认数据库名称：`ai_meeting`
- [ ] 确认数据库用户：`postgres`（或自定义）
- [ ] 数据库密码与 `.env.production` 中一致

## ✅ 应用配置检查

### 后端配置

- [ ] `apps/backend/package.json` 存在
- [ ] `apps/backend/src` 目录存在
- [ ] 后端端口：3000（默认）

### 前端配置

- [ ] `apps/web/package.json` 存在
- [ ] `apps/web/src` 目录存在
- [ ] `apps/web/nginx.conf` 文件存在
- [ ] Nginx 配置中的后端地址：`http://backend:3000`

## ✅ Docker 配置检查

- [ ] `docker-compose.prod.yml` 中的服务名称正确
- [ ] 服务依赖关系正确（backend 依赖 postgres 和 redis）
- [ ] 端口映射正确（frontend: 80:80, 443:443）
- [ ] 卷挂载路径正确（`./deploy/ssl:/etc/nginx/ssl:ro`）
- [ ] 网络配置正确（custom bridge network）

```bash
# 验证 Docker Compose 配置
cd /root/ai_meeting
docker-compose --env-file .env.production -f docker-compose.prod.yml config
```

## ✅ 脚本权限检查

- [ ] `deploy/scripts/deploy.sh` 有执行权限
- [ ] `deploy/ssl/generate-self-signed-cert.sh` 有执行权限（如需要）

```bash
chmod +x /root/ai_meeting/deploy/scripts/deploy.sh
chmod +x /root/ai_meeting/deploy/ssl/generate-self-signed-cert.sh
```

## ✅ 依赖服务检查

- [ ] 服务器可以访问 Docker Hub：`docker pull alpine:latest`
- [ ] 服务器可以访问 npm registry：`curl -I https://registry.npmjs.org`
- [ ] 如果在内网，已配置 Docker 和 npm 镜像源

```bash
# 配置 Docker 镜像加速（可选）
cat > /etc/docker/daemon.json << 'DOCKER_EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
DOCKER_EOF

systemctl restart docker

# 配置 npm 镜像（可选）
npm config set registry https://registry.npmmirror.com
```

## ✅ 安全检查

- [ ] 数据库密码不使用默认值
- [ ] Redis 密码不使用默认值
- [ ] JWT 密钥随机生成（不能泄露）
- [ ] `.env.production` 文件权限为 600：`chmod 600 .env.production`
- [ ] 已准备好定期备份策略

```bash
# 设置敏感文件权限
chmod 600 /root/ai_meeting/.env.production
chmod 600 /root/ai_meeting/deploy/ssl/key.pem
```

## ✅ 备份和回滚计划

- [ ] 已备份现有数据（如果有）
- [ ] 已准备好回滚方案
- [ ] 知道如何停止服务：`docker-compose --env-file .env.production -f docker-compose.prod.yml down`
- [ ] 知道如何查看日志：`docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f`

## ✅ 监控和通知

- [ ] 已准备好监控日志的方法
- [ ] 已准备好接收部署结果通知的渠道
- [ ] 已准备好紧急联系人和升级路径

## ✅ 最后确认

- [ ] 已阅读 `deploy/QUICK_START.md`
- [ ] 已阅读 `deploy/DEPLOYMENT.md`
- [ ] 理解部署流程的每一步
- [ ] 已预留 20-30 分钟时间完成部署
- [ ] 在非高峰时段执行部署（推荐）

---

## 一键检查脚本

将以下脚本保存为 `deploy/scripts/pre-check.sh` 并执行：

```bash
#!/bin/bash

echo "=========================================="
echo "部署前环境检查"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 已安装: $(command -v $1)"
        return 0
    else
        echo -e "${RED}✗${NC} $1 未安装"
        return 1
    fi
}

check_port() {
    if netstat -tlnp 2>/dev/null | grep -q ":$1 "; then
        echo -e "${RED}✗${NC} 端口 $1 已被占用"
        netstat -tlnp | grep ":$1 "
        return 1
    else
        echo -e "${GREEN}✓${NC} 端口 $1 可用"
        return 0
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} 文件存在: $1"
        return 0
    else
        echo -e "${RED}✗${NC} 文件缺失: $1"
        return 1
    fi
}

check_disk_space() {
    available=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$available" -gt 10 ]; then
        echo -e "${GREEN}✓${NC} 磁盘空间充足: ${available}GB 可用"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} 磁盘空间不足: 仅 ${available}GB 可用（建议 >10GB）"
        return 1
    fi
}

# 1. 检查基础命令
echo "1. 检查基础环境"
check_command docker
check_command docker-compose
check_command openssl
echo ""

# 2. 检查 Docker 服务
echo "2. 检查 Docker 服务"
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓${NC} Docker 服务运行中"
else
    echo -e "${RED}✗${NC} Docker 服务未运行"
fi
echo ""

# 3. 检查端口
echo "3. 检查端口占用"
check_port 80
check_port 443
check_port 5432
check_port 6379
echo ""

# 4. 检查磁盘空间
echo "4. 检查磁盘空间"
check_disk_space
echo ""

# 5. 检查必要文件
echo "5. 检查部署文件"
cd /root/ai_meeting 2>/dev/null || { echo -e "${RED}✗${NC} 目录不存在: /root/ai_meeting"; exit 1; }
check_file "docker-compose.prod.yml"
check_file ".env.production"
check_file "apps/backend/Dockerfile"
check_file "apps/web/Dockerfile"
check_file "apps/web/nginx.conf"
check_file "deploy/scripts/deploy.sh"
echo ""

# 6. 检查环境变量
echo "6. 检查环境变量配置"
if [ -f ".env.production" ]; then
    if grep -q "changeme" .env.production; then
        echo -e "${RED}✗${NC} 发现默认密码 'changeme'，请修改"
    else
        echo -e "${GREEN}✓${NC} 环境变量已自定义"
    fi
    
    if grep -q "YOUR_" .env.production; then
        echo -e "${RED}✗${NC} 发现占位符 'YOUR_*'，请修改"
    else
        echo -e "${GREEN}✓${NC} 无占位符"
    fi
fi
echo ""

# 7. 检查 SSL 证书
echo "7. 检查 SSL 证书"
check_file "deploy/ssl/cert.pem"
check_file "deploy/ssl/key.pem"
echo ""

# 8. 检查网络连接
echo "8. 检查网络连接"
if ping -c 1 registry.npmjs.org &> /dev/null; then
    echo -e "${GREEN}✓${NC} npm registry 可访问"
else
    echo -e "${YELLOW}⚠${NC} npm registry 不可访问（可能影响构建）"
fi

if docker pull alpine:latest &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Hub 可访问"
    docker rmi alpine:latest &> /dev/null
else
    echo -e "${YELLOW}⚠${NC} Docker Hub 不可访问（可能影响构建）"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "如果所有检查项都显示 ✓，可以执行部署："
echo "  cd /root/ai_meeting/deploy/scripts"
echo "  ./deploy.sh"
echo ""
```

## 执行检查

```bash
# 创建检查脚本
cat > /root/ai_meeting/deploy/scripts/pre-check.sh << 'SCRIPT_EOF'
# [将上面的脚本内容粘贴到这里]
SCRIPT_EOF

# 赋予执行权限
chmod +x /root/ai_meeting/deploy/scripts/pre-check.sh

# 执行检查
cd /root/ai_meeting
./deploy/scripts/pre-check.sh
```

---

**当所有检查项都通过后，就可以开始部署了！**

```bash
cd /root/ai_meeting/deploy/scripts
./deploy.sh
```

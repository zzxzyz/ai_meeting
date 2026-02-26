# REQ-003 实时音视频通话 - 部署检查清单

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话
- **文档类型**: 部署检查清单
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: devops-leader
- **状态**: 就绪

---

## 部署前检查清单

### ✅ 1. 后端服务配置验证

| 检查项 | 状态 | 验证方法 |
|--------|------|---------|
| mediasoup 依赖已安装 | ✅ 就绪 | `package.json` 包含 `"mediasoup": "^3.19.17"` |
| mediasoup 服务已实现 | ✅ 就绪 | `src/infrastructure/mediasoup/mediasoup.service.ts` 存在 |
| WebSocket Gateway 信令处理 | ✅ 就绪 | `src/api/gateways/meeting.gateway.ts` 包含 RTC 信令 |
| 媒体配置 API 已实现 | ✅ 就绪 | `src/api/controllers/media/media.controller.ts` 存在 |

### ✅ 2. 前端服务配置验证

| 检查项 | 状态 | 验证方法 |
|--------|------|---------|
| mediasoup-client 依赖已安装 | ✅ 就绪 | `apps/web/package.json` 包含 `"mediasoup-client": "^3.6.0"` |
| WebRTC 服务已实现 | ✅ 就绪 | `apps/web/src/services/media.service.ts` 存在 |
| 会议室页面组件 | ✅ 就绪 | `apps/web/src/pages/MeetingRoom/index.tsx` 存在 |
| 视频网格组件 | ✅ 就绪 | `apps/web/src/components/VideoGrid/index.tsx` 存在 |

### ✅ 3. Docker 配置更新

| 检查项 | 状态 | 验证方法 |
|--------|------|---------|
| mediasoup 环境变量配置 | ✅ 就绪 | `docker-compose.prod.yml` 已更新 |
| UDP 端口映射配置 | ✅ 就绪 | 端口范围 40000-49999/udp 已映射 |
| 后端服务健康检查 | ✅ 就绪 | 健康检查配置完整 |

### ✅ 4. 环境变量配置

| 环境变量 | 必需性 | 默认值 | 说明 |
|----------|--------|--------|------|
| `MEDIASOUP_WORKER_NUM` | 可选 | `1` | Worker 进程数 |
| `MEDIASOUP_LOG_LEVEL` | 可选 | `warn` | 日志级别 |
| `MEDIASOUP_RTC_MIN_PORT` | 可选 | `40000` | RTP 端口起始 |
| `MEDIASOUP_RTC_MAX_PORT` | 可选 | `49999` | RTP 端口结束 |
| `MEDIASOUP_STUN_SERVERS` | 可选 | Google STUN | STUN 服务器配置 |
| `MEDIASOUP_TURN_SERVER` | 可选 | 空 | TURN 服务器地址 |
| `MEDIASOUP_TURN_USERNAME` | 可选 | 空 | TURN 用户名 |
| `MEDIASOUP_TURN_PASSWORD` | 可选 | 空 | TURN 密码 |
| `MEDIASOUP_ANNOUNCED_IP` | **必需** | 空 | 服务器公网 IP |

---

## 部署操作步骤

### 步骤 1: 更新代码库

```bash
# 拉取最新代码
git pull origin main

# 确认 REQ-003 相关文件存在
ls -la apps/backend/src/infrastructure/mediasoup/
ls -la apps/web/src/services/media.service.ts
```

### 步骤 2: 安装依赖

```bash
# 安装前端依赖
cd apps/web && pnpm install

# 安装后端依赖
cd ../backend && pnpm install

# 返回根目录
cd ../..
```

### 步骤 3: 配置环境变量

编辑 `.env.production` 文件，添加以下配置：

```bash
# mediasoup 配置
MEDIASOUP_WORKER_NUM=1
MEDIASOUP_LOG_LEVEL=warn
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999
MEDIASOUP_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
MEDIASOUP_TURN_SERVER=
MEDIASOUP_TURN_USERNAME=
MEDIASOUP_TURN_PASSWORD=
MEDIASOUP_ANNOUNCED_IP=YOUR_SERVER_PUBLIC_IP
```

**重要**: `MEDIASOUP_ANNOUNCED_IP` 必须设置为服务器的公网 IP 地址。

### 步骤 4: 构建镜像

```bash
# 构建后端镜像
docker-compose -f docker-compose.prod.yml build backend

# 构建前端镜像
docker-compose -f docker-compose.prod.yml build frontend
```

### 步骤 5: 启动服务

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 检查服务状态
docker-compose -f docker-compose.prod.yml ps
```

### 步骤 6: 验证部署

```bash
# 检查后端服务健康
curl http://localhost:3000/api/v1/health

# 检查媒体配置 API（需要 JWT Token）
curl -H "Authorization: Bearer {token}" \
     http://localhost:3000/api/v1/meetings/{meetingId}/media-config

# 检查 UDP 端口监听
netstat -tlnp | grep :40000

# 检查容器日志
docker-compose -f docker-compose.prod.yml logs backend --tail=50
```

---

## 防火墙配置

### CentOS/OpenCloudOS (firewalld)

```bash
# 开放 HTTP/HTTPS 端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp

# 开放后端 API 端口
firewall-cmd --permanent --add-port=3000/tcp

# 开放 mediasoup RTP 端口范围
firewall-cmd --permanent --add-port=40000-49999/udp

# 重新加载防火墙
firewall-cmd --reload
```

### Ubuntu (ufw)

```bash
# 开放端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 40000:49999/udp

# 启用防火墙
ufw enable
```

---

## 故障排查指南

### 问题 1: mediasoup Worker 启动失败

**症状**: 后端日志显示 `mediasoup Worker died`

**解决方案**:
```bash
# 检查系统资源
docker stats

# 增加 Worker 数量
export MEDIASOUP_WORKER_NUM=2
docker-compose -f docker-compose.prod.yml up -d backend
```

### 问题 2: WebRTC 连接失败

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

### 问题 3: 前端构建失败

**症状**: 前端构建时提示 `mediasoup-client` 未找到

**解决方案**:
```bash
# 重新安装前端依赖
cd apps/web && rm -rf node_modules && pnpm install

# 重新构建前端
docker-compose -f docker-compose.prod.yml build frontend --no-cache
```

### 问题 4: UDP 端口冲突

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

## 性能监控指标

### 关键指标

| 指标 | 目标值 | 监控方法 |
|------|--------|---------|
| WebRTC 连接延迟 | < 300ms | WebRTC stats API |
| 音视频丢包率 | < 5% | mediasoup 统计信息 |
| CPU 使用率 | < 80% | `docker stats` |
| 内存使用率 | < 90% | `docker stats` |
| 网络带宽使用 | 可配置 | 端口流量监控 |

### 监控命令

```bash
# 实时监控容器资源
docker stats

# 查看后端日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 检查网络连接
netstat -tlnp | grep -E "(3000|40000)"
```

---

## 回滚方案

### 快速回滚步骤

```bash
# 1. 停止当前服务
docker-compose -f docker-compose.prod.yml down

# 2. 回滚到上一个版本
git checkout HEAD~1 -- docker-compose.prod.yml apps/web/package.json

# 3. 重新构建和启动
docker-compose -f docker-compose.prod.yml build backend frontend
docker-compose -f docker-compose.prod.yml up -d

# 4. 验证回滚成功
curl http://localhost:3000/api/v1/health
```

### 数据备份

```bash
# 备份数据库
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres ai_meeting > /opt/backups/pre_REQ003_$(date +%Y%m%d_%H%M%S).sql
```

---

## 多端互通验证计划

### 验证矩阵

| 客户端组合 | 验证状态 | 测试要点 |
|-----------|---------|---------|
| Chrome ↔ Chrome | ✅ 就绪 | 音视频双向通话 |
| Chrome ↔ Safari | ✅ 就绪 | 跨浏览器兼容性 |
| Chrome ↔ Firefox | ✅ 就绪 | 编码器兼容性 |
| Web ↔ Electron | ✅ 就绪 | 桌面端互通 |
| 弱网环境 (20% 丢包) | ✅ 就绪 | 音视频降级处理 |

### 验证步骤

1. **基础功能验证**
   - 创建会议并加入音视频房间
   - 验证本地视频预览正常
   - 验证音频设备检测正常

2. **多端互通验证**
   - 使用不同浏览器/客户端加入同一会议
   - 验证双向音视频通话质量
   - 验证参会者加入/离开通知

3. **性能验证**
   - 4 人同时通话稳定性测试
   - 弱网环境适应性测试
   - 长时间通话内存监控

---

## 文档维护

- **维护人**: devops-leader
- **更新频率**: 每次部署前检查
- **版本控制**: Git 版本管理
- **关联文档**:
  - `deploy/DEPLOYMENT.md` - 通用部署指南
  - `docs/versions/v0.1/requirements/REQ-003/deployment_notes.md` - 详细部署备注

---

**文档版本**: v1.0
**最后更新**: 2026-02-26
**状态**: ✅ 部署就绪
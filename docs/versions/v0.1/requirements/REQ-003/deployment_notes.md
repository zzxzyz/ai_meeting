# REQ-003 实时音视频通话 - 部署备注

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话
- **文档类型**: 部署备注
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: devops-leader
- **状态**: 就绪

---

## 部署检查清单

### 1. 后端服务环境变量配置

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `MEDIASOUP_WORKER_NUM` | **就绪** | mediasoup Worker 进程数，默认 1 |
| `MEDIASOUP_LOG_LEVEL` | **就绪** | mediasoup 日志级别，默认 "warn" |
| `MEDIASOUP_RTC_MIN_PORT` | **就绪** | RTP 端口范围起始，默认 40000 |
| `MEDIASOUP_RTC_MAX_PORT` | **就绪** | RTP 端口范围结束，默认 49999 |
| `MEDIASOUP_STUN_SERVERS` | **就绪** | STUN 服务器配置，默认 Google STUN |
| `MEDIASOUP_TURN_SERVER` | **可选** | TURN 服务器地址（内网环境可不配） |
| `MEDIASOUP_TURN_USERNAME` | **可选** | TURN 服务器用户名 |
| `MEDIASOUP_TURN_PASSWORD` | **可选** | TURN 服务器密码 |
| `MEDIASOUP_ANNOUNCED_IP` | **必需** | mediasoup 对外公告的 IP 地址 |

**环境变量配置示例**：
```bash
# mediasoup 基础配置
MEDIASOUP_WORKER_NUM=1
MEDIASOUP_LOG_LEVEL=warn
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999

# STUN/TURN 服务器配置
MEDIASOUP_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
MEDIASOUP_TURN_SERVER=turn:turn.example.com:3478
MEDIASOUP_TURN_USERNAME=your-turn-username
MEDIASOUP_TURN_PASSWORD=your-turn-password

# 网络配置（关键）
MEDIASOUP_ANNOUNCED_IP=YOUR_SERVER_PUBLIC_IP
```

### 2. Docker Compose 网络端口配置

| 检查项 | 状态 | 说明 |
|--------|------|------|
| UDP 端口范围映射 | **就绪** | 40000-49999 UDP 端口映射 |
| 后端服务端口暴露 | **就绪** | 3000 端口用于 API 和 WebSocket |

**端口映射配置**：
```yaml
backend:
  ports:
    - "3000:3000"
    - "40000-49999:40000-49999/udp"  # mediasoup RTP 端口范围
```

### 3. 防火墙规则配置

| 检查项 | 状态 | 说明 |
|--------|------|------|
| TCP 3000 端口开放 | **就绪** | API 和 WebSocket 连接 |
| UDP 40000-49999 端口开放 | **就绪** | mediasoup RTP 媒体流传输 |

**防火墙配置命令**：
```bash
# CentOS/OpenCloudOS (firewalld)
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --permanent --add-port=40000-49999/udp
firewall-cmd --reload

# Ubuntu (ufw)
ufw allow 3000/tcp
ufw allow 40000:49999/udp
ufw enable
```

### 4. 前端构建产物验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 会议室音视频页面 | **就绪** | `apps/web/src/pages/MeetingRoom/index.tsx` |
| WebRTC 服务封装 | **就绪** | `apps/web/src/services/webrtc.service.ts` |
| 视频网格组件 | **就绪** | `apps/web/src/components/VideoGrid/index.tsx` |
| 音视频权限处理 | **就绪** | 摄像头/麦克风权限请求和降级处理 |

### 5. Electron 桌面端打包验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 音视频权限声明 | **就绪** | `apps/electron/package.json` 权限配置 |
| WebRTC 支持 | **就绪** | Electron Chromium 内核支持 WebRTC |
| 摄像头/麦克风访问 | **就绪** | 桌面端音视频设备访问权限 |

---

## docker-compose.prod.yml 更新

### 后端服务环境变量补充

在 `backend` 服务配置中添加 mediasoup 相关环境变量：

```yaml
backend:
  environment:
    # ... 现有配置保持不变

    # mediasoup 配置（新增）
    MEDIASOUP_WORKER_NUM: ${MEDIASOUP_WORKER_NUM:-1}
    MEDIASOUP_LOG_LEVEL: ${MEDIASOUP_LOG_LEVEL:-warn}
    MEDIASOUP_RTC_MIN_PORT: ${MEDIASOUP_RTC_MIN_PORT:-40000}
    MEDIASOUP_RTC_MAX_PORT: ${MEDIASOUP_RTC_MAX_PORT:-49999}
    MEDIASOUP_STUN_SERVERS: ${MEDIASOUP_STUN_SERVERS:-stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302}
    MEDIASOUP_TURN_SERVER: ${MEDIASOUP_TURN_SERVER:-}
    MEDIASOUP_TURN_USERNAME: ${MEDIASOUP_TURN_USERNAME:-}
    MEDIASOUP_TURN_PASSWORD: ${MEDIASOUP_TURN_PASSWORD:-}
    MEDIASOUP_ANNOUNCED_IP: ${MEDIASOUP_ANNOUNCED_IP:-}
```

### UDP 端口映射补充

在 `backend` 服务端口配置中添加 UDP 端口映射：

```yaml
backend:
  ports:
    - "3000:3000"
    - "40000-49999:40000-49999/udp"  # mediasoup RTP 端口范围
```

---

## 环境变量配置文件

### .env.production 模板更新

在现有的 `.env.production` 模板中添加以下配置：

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

**重要说明**：
- `MEDIASOUP_ANNOUNCED_IP` 必须设置为服务器的公网 IP 地址
- TURN 服务器配置为可选，仅在需要 NAT 穿透时配置
- 内网环境可不配置 TURN 服务器

---

## 多端互通验证计划

### 1. Web 端 ↔ Web 端验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| Chrome ↔ Chrome 音视频 | 两个 Chrome 浏览器加入同一会议 | 双向音视频通话正常 |
| Chrome ↔ Safari 互通 | Chrome 与 Safari 浏览器互通 | 跨浏览器音视频正常 |
| 权限拒绝处理 | 拒绝摄像头/麦克风权限 | 降级为仅音频/仅视频模式 |

### 2. Web 端 ↔ Electron 端验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| Web Chrome ↔ Electron | Web 端与桌面端互通 | 双向音视频通话正常 |
| 桌面端权限处理 | Electron 请求摄像头/麦克风权限 | 系统权限对话框正常弹出 |

### 3. 弱网环境验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 20% 丢包音频可用性 | 模拟网络丢包 | 音频基本可用，有轻微断续 |
| 弱网视频降级 | 带宽限制 500kbps | 视频自动降级到低分辨率 |
| 网络恢复质量提升 | 移除网络限制 | 音视频质量自动恢复 |

### 4. 性能指标验证

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 端到端延迟 | < 300ms | WebRTC stats API 测量 |
| 连接建立时间 | < 3s | 从点击"加入"到视频显示的时间 |
| 视频分辨率 | 720p@30fps | 网络良好时稳定输出 |
| 4 人通话稳定性 | CPU < 80% | 监控系统资源使用 |

---

## 回滚方案

### 场景 1：mediasoup 服务异常

```bash
# 停止后端服务
docker-compose -f docker-compose.prod.yml stop backend

# 回滚到无 mediasoup 配置的版本
git checkout HEAD~1 -- docker-compose.prod.yml

# 重新启动
docker-compose -f docker-compose.prod.yml up -d backend
```

### 场景 2：UDP 端口冲突

```bash
# 检查端口占用
netstat -tlnp | grep :40000

# 修改端口范围（如改为 50000-59999）
export MEDIASOUP_RTC_MIN_PORT=50000
export MEDIASOUP_RTC_MAX_PORT=59999

# 重启服务
docker-compose -f docker-compose.prod.yml up -d backend
```

### 场景 3：音视频功能异常

```bash
# 查看后端日志
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# 检查 mediasoup Worker 状态
docker-compose -f docker-compose.prod.yml exec backend ps aux | grep mediasoup

# 临时禁用音视频功能（修改前端配置）
export VITE_ENABLE_WEBRTC=false
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

---

## 已知问题与注意事项

### 1. mediasoup Worker 进程管理
- mediasoup Worker 进程由 Node.js 主进程管理
- Worker 异常退出时会触发主进程重启
- 生产环境建议设置 `MEDIASOUP_WORKER_NUM=2` 以提高可用性

### 2. UDP 端口范围配置
- RTP 端口范围必须与防火墙配置一致
- 端口范围大小影响并发通话人数（每个参会者需要多个端口）
- 默认 40000-49999 支持约 1000 个并发参会者

### 3. 公网 IP 配置
- `MEDIASOUP_ANNOUNCED_IP` 必须设置为服务器的公网 IP
- 错误的 IP 配置会导致 WebRTC 连接失败
- 云服务器环境需注意弹性 IP 和 NAT 配置

### 4. TURN 服务器依赖
- 内网环境可不配置 TURN 服务器
- 公网环境建议配置 TURN 服务器以提高连接成功率
- TURN 服务器需要独立部署和维护

### 5. 浏览器兼容性
- Safari 对 Simulcast 支持有限，使用单层传输
- 老版本浏览器可能需要 polyfill
- 移动端浏览器支持需要额外测试

---

## 部署操作顺序

1. **备份当前环境**
   ```bash
   docker-compose -f docker-compose.prod.yml exec -T postgres \
     pg_dump -U postgres ai_meeting > /opt/backups/pre_REQ003_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **更新 docker-compose.prod.yml**
   ```bash
   git pull origin main
   ```

3. **配置环境变量**
   ```bash
   # 编辑 .env.production
   vi .env.production
   # 添加 mediasoup 相关配置
   ```

4. **重新构建镜像**
   ```bash
   docker-compose -f docker-compose.prod.yml build --no-cache backend frontend
   ```

5. **重启服务**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

6. **验证部署**
   ```bash
   # 检查服务状态
   docker-compose -f docker-compose.prod.yml ps

   # 测试音视频 API
   curl -H "Authorization: Bearer {token}" \
        http://localhost:3000/api/v1/meetings/{meetingId}/media-config

   # 检查 UDP 端口监听
   netstat -tlnp | grep :40000
   ```

---

**文档版本**: v1.0
**创建日期**: 2026-02-26
**维护人**: devops-leader
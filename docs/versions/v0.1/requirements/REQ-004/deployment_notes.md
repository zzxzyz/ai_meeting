# REQ-004 音视频控制功能 - 部署备注

## 文档信息

- **需求编号**: REQ-004
- **需求名称**: 音视频控制功能
- **文档类型**: 部署备注
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: devops-leader
- **状态**: 就绪

---

## 部署检查清单

### 1. 后端服务环境变量配置（新增）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `CONTROL_COMMAND_TIMEOUT` | **就绪** | 控制指令超时时间，默认 5000ms |
| `CONTROL_SYNC_INTERVAL` | **就绪** | 状态同步间隔，默认 30000ms |
| `CONTROL_MAX_RETRIES` | **就绪** | 最大重试次数，默认 3 |
| `CONTROL_STATE_EXPIRATION` | **就绪** | 状态过期时间，默认 1800000ms (30分钟) |

**环境变量配置示例**：
```bash
# 音视频控制功能配置
CONTROL_COMMAND_TIMEOUT=5000
CONTROL_SYNC_INTERVAL=30000
CONTROL_MAX_RETRIES=3
CONTROL_STATE_EXPIRATION=1800000
```

### 2. 后端服务配置验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| MeetingGateway 信令扩展 | **就绪** | 新增音视频控制信令处理 |
| ControlService 服务实现 | **就绪** | 音视频控制业务逻辑 |
| RoomService 状态管理 | **就绪** | Peer 控制状态持久化 |
| 单元测试覆盖率 | **就绪** | 100% 覆盖率验证 |

### 3. 前端服务配置验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| SignalingService 扩展 | **就绪** | 音视频控制信令封装 |
| MeetingRoom 页面集成 | **就绪** | 控制按钮和状态显示 |
| 状态同步机制 | **就绪** | 远端用户状态实时同步 |
| 错误处理机制 | **就绪** | 控制失败的用户反馈 |

### 4. 客户端配置验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Electron 信令集成 | **就绪** | WebSocket 控制信令支持 |
| 音视频设备权限 | **就绪** | 桌面端设备访问权限 |
| 控制状态持久化 | **就绪** | 页面刷新状态保持 |

---

## docker-compose.prod.yml 更新

### 后端服务环境变量补充

在 `backend` 服务配置中添加音视频控制相关环境变量：

```yaml
backend:
  environment:
    # ... 现有配置保持不变

    # 音视频控制功能配置（REQ-004 新增）
    CONTROL_COMMAND_TIMEOUT: ${CONTROL_COMMAND_TIMEOUT:-5000}
    CONTROL_SYNC_INTERVAL: ${CONTROL_SYNC_INTERVAL:-30000}
    CONTROL_MAX_RETRIES: ${CONTROL_MAX_RETRIES:-3}
    CONTROL_STATE_EXPIRATION: ${CONTROL_STATE_EXPIRATION:-1800000}
```

### 前端构建参数补充

在 `frontend` 服务构建参数中添加控制功能相关配置：

```yaml
frontend:
  build:
    context: .
    dockerfile: apps/web/Dockerfile
    args:
      # ... 现有配置保持不变

      # 音视频控制功能启用（REQ-004 新增）
      VITE_ENABLE_AUDIO_CONTROL: ${VITE_ENABLE_AUDIO_CONTROL:-true}
      VITE_ENABLE_VIDEO_CONTROL: ${VITE_ENABLE_VIDEO_CONTROL:-true}
```

---

## 环境变量配置文件

### .env.production 模板更新

在现有的 `.env.production` 模板中添加以下配置：

```bash
# ==========================================
# REQ-004 音视频控制功能配置
# ==========================================

# 控制指令超时时间（毫秒）
CONTROL_COMMAND_TIMEOUT=5000

# 状态同步间隔（毫秒）
CONTROL_SYNC_INTERVAL=30000

# 最大重试次数
CONTROL_MAX_RETRIES=3

# 状态过期时间（毫秒）
CONTROL_STATE_EXPIRATION=1800000

# 前端控制功能启用
VITE_ENABLE_AUDIO_CONTROL=true
VITE_ENABLE_VIDEO_CONTROL=true
```

**重要说明**：
- 控制超时时间应根据网络环境调整
- 状态同步间隔影响实时性，可根据并发量调整
- 状态过期时间确保内存使用合理

---

## 功能验证计划

### 1. 本地控制功能验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 音频静音/取消静音 | 点击音频控制按钮 | 本地状态正确更新，延迟 < 100ms |
| 视频关闭/开启 | 点击视频控制按钮 | 本地状态正确更新，延迟 < 100ms |
| 控制状态持久化 | 刷新页面 | 控制状态正确保持 |

### 2. 远端状态同步验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 音频状态同步 | 用户A静音，用户B观察 | 状态同步延迟 < 200ms |
| 视频状态同步 | 用户A关闭视频，用户B观察 | 状态同步延迟 < 200ms |
| 多用户并发控制 | 3用户同时控制 | 状态同步无冲突 |

### 3. 新用户加入状态同步验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 新用户加入 | 已有用户控制状态，新用户加入 | 新用户立即获得正确状态 |
| 状态同步完整性 | 多用户不同状态场景 | 所有状态正确同步 |

### 4. 异常处理验证

| 验证项 | 测试方法 | 预期结果 |
|--------|---------|---------|
| 设备异常处理 | 模拟设备断开 | 给出适当错误提示 |
| 网络中断恢复 | 模拟网络中断 | 状态保持，恢复后自动同步 |
| 权限拒绝处理 | 拒绝设备权限 | 降级处理，状态一致 |

### 5. 性能指标验证

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 控制操作延迟 | < 100ms | 端到端延迟测量 |
| 状态同步延迟 | < 200ms | 多端同步时间测量 |
| 大房间同步性能 | 10用户场景 < 500ms | 并发控制测试 |
| 系统资源使用 | CPU < 80%，内存稳定 | 长时间运行监控 |

---

## 回滚方案

### 场景 1：控制功能异常

```bash
# 停止后端服务
docker-compose -f docker-compose.prod.yml stop backend

# 临时禁用控制功能
export VITE_ENABLE_AUDIO_CONTROL=false
export VITE_ENABLE_VIDEO_CONTROL=false

# 重新构建前端
docker-compose -f docker-compose.prod.yml build frontend

# 重启服务
docker-compose -f docker-compose.prod.yml up -d backend frontend
```

### 场景 2：状态同步异常

```bash
# 查看后端日志
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# 检查 WebSocket 连接状态
docker-compose -f docker-compose.prod.yml exec backend netstat -an | grep :3000

# 临时调整同步间隔
export CONTROL_SYNC_INTERVAL=60000  # 延长到 60 秒
docker-compose -f docker-compose.prod.yml up -d backend
```

### 场景 3：前端控制界面异常

```bash
# 查看前端日志
docker-compose -f docker-compose.prod.yml logs --tail=100 frontend

# 检查前端构建产物
docker-compose -f docker-compose.prod.yml exec frontend ls -la /usr/share/nginx/html

# 重新构建前端
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

---

## 监控指标配置

### 1. 后端监控指标（新增）

在 Prometheus 监控配置中添加以下指标：

```yaml
# 控制指令延迟分布
- name: control_command_duration_seconds
  help: 控制指令执行延迟分布
  type: histogram
  labels:
    - command_type
    - success

# 控制指令成功率
- name: control_command_total
  help: 控制指令执行总数
  type: counter
  labels:
    - command_type
    - success

# 状态同步延迟
- name: state_sync_duration_seconds
  help: 状态同步延迟分布
  type: histogram

# 状态同步成功率
- name: state_sync_total
  help: 状态同步执行总数
  type: counter
  labels:
    - success
```

### 2. 告警规则配置

```yaml
# 控制指令失败率告警
- alert: HighControlCommandFailureRate
  expr: rate(control_command_total{success="false"}[5m]) / rate(control_command_total[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "控制指令失败率过高"
    description: "过去5分钟控制指令失败率超过10%"

# 状态同步延迟告警
- alert: HighStateSyncLatency
  expr: histogram_quantile(0.95, rate(state_sync_duration_seconds_bucket[5m])) > 0.5
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "状态同步延迟过高"
    description: "95%的状态同步延迟超过500ms"
```

---

## 已知问题与注意事项

### 1. 控制状态一致性
- 网络异常时可能出现状态不一致
- 系统设计包含自动修复机制
- 建议定期检查状态同步日志

### 2. 并发控制冲突
- 多用户同时控制可能产生冲突
- 系统采用最终一致性策略
- 冲突解决策略：后发者覆盖先发者

### 3. 性能优化建议
- 大房间场景建议增加状态同步间隔
- 高并发场景建议增加 Worker 数量
- 监控系统资源使用情况

### 4. 浏览器兼容性
- 控制功能依赖 WebSocket 连接
- 老版本浏览器可能需要降级处理
- 移动端浏览器支持已验证

### 5. 安全考虑
- 控制权限验证确保安全
- 信令传输采用加密通道
- 频率限制防止恶意操作

---

## 部署操作顺序

1. **备份当前环境**
   ```bash
   docker-compose -f docker-compose.prod.yml exec -T postgres \
     pg_dump -U postgres ai_meeting > /opt/backups/pre_REQ004_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **更新代码和配置**
   ```bash
   git pull origin main
   # 更新 .env.production 文件
   vi .env.production
   ```

3. **重新构建镜像**
   ```bash
   docker-compose -f docker-compose.prod.yml build --no-cache backend frontend
   ```

4. **重启服务**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **验证部署**
   ```bash
   # 检查服务状态
   docker-compose -f docker-compose.prod.yml ps

   # 测试控制功能 API
   curl -H "Authorization: Bearer {token}" \
        http://localhost:3000/api/v1/health/control

   # 检查 WebSocket 连接
   wscat -c ws://localhost:3000
   ```

6. **监控验证**
   ```bash
   # 查看控制功能相关日志
   docker-compose -f docker-compose.prod.yml logs --tail=50 backend | grep -i control

   # 检查监控指标
   curl http://localhost:3000/metrics | grep control_
   ```

---

**文档版本**: v1.0
**创建日期**: 2026-02-26
**维护人**: devops-leader
# REQ-002 会议管理 - 部署备注

## 文档信息

- **需求编号**: REQ-002
- **需求名称**: 会议管理
- **文档类型**: 部署备注
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: devops-leader
- **状态**: 就绪

---

## 部署检查清单

### 1. 数据库迁移

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `meetings` 表 DDL | **就绪** | 已追加至 `deploy/init-db.sql` |
| `meeting_participants` 表 DDL | **就绪** | 已追加至 `deploy/init-db.sql` |
| `meeting_number` UNIQUE 约束 | **就绪** | 含数据库级别 UNIQUE 约束，与代码重试机制双重保障 |
| `(meeting_id, user_id)` 联合唯一约束 | **就绪** | 防止同用户在同会议重复参与记录 |
| 外键约束（`creator_id → users.id`） | **就绪** | 级联策略：用户删除时拒绝（默认 RESTRICT） |
| 外键约束（`meeting_id → meetings.id`） | **就绪** | ON DELETE CASCADE |
| 索引（`creator_id`、`status`、`created_at`、`meeting_number`） | **就绪** | 按 `api_contract.md` 数据模型定义创建 |

**重要说明**：
- 生产环境 `DATABASE_SYNCHRONIZE=false`，TypeORM 不会自动建表。
- `deploy/init-db.sql` 挂载为 `/docker-entrypoint-initdb.d/init.sql`，**仅在数据库卷首次创建时执行**。
- 若数据库已存在（升级部署），需手动执行迁移 SQL 或使用 TypeORM Migration。

**升级部署手动迁移命令**：

```bash
# 进入 PostgreSQL 容器执行 DDL
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting \
  -c "$(cat deploy/migrations/REQ-002-meetings.sql)"
```

---

### 2. 后端路由注册

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `MeetingModule` 在 `AppModule` 中注册 | **就绪** | `apps/backend/src/app.module.ts` 第 66 行已导入 |
| `MeetingController` 路由前缀 | **就绪** | `@Controller('meetings')` + 全局前缀 `api/v1` |
| 完整 API 路径 | **就绪** | 见下表 |
| `MeetingGateway` WebSocket 注册 | **就绪** | `MeetingModule` providers 中已注册 |
| JWT 鉴权 Guard | **就绪** | `@UseGuards(ThrottlerAuthGuard, JwtAuthGuard)` 全局应用 |

**已注册路由清单**：

| HTTP 方法 | 路径 | 功能 |
|----------|------|------|
| POST | `/api/v1/meetings` | 创建会议（限流 10 次/分钟） |
| POST | `/api/v1/meetings/join` | 加入会议（限流 20 次/分钟） |
| GET  | `/api/v1/meetings` | 查询会议列表（限流 60 次/分钟） |
| GET  | `/api/v1/meetings/:meetingId` | 查询会议详情（限流 60 次/分钟） |
| POST | `/api/v1/meetings/:meetingId/end` | 结束会议（限流 5 次/分钟） |

---

### 3. 前端构建产物

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 会议列表页 `MeetingListPage` | **就绪** | `apps/web/src/pages/MeetingList/index.tsx` |
| 会议详情页 `MeetingDetailPage` | **就绪** | `apps/web/src/pages/MeetingDetail/index.tsx` |
| 首页 `HomePage`（含创建/加入入口） | **就绪** | `apps/web/src/pages/Home/index.tsx` |
| 路由注册（`/meetings`、`/meetings/:id`） | **就绪** | `apps/web/src/App.tsx` 已注册两条路由 |
| Meeting Store（Pinia/Zustand） | **就绪** | `apps/web/src/stores/meetingStore.ts` |
| Meeting API Service | **就绪** | `apps/web/src/api/meeting.ts` |
| 会议相关 UI 组件 | **就绪** | `CreateMeetingModal`、`JoinMeetingInput`、`MeetingCard`、`EndMeetingModal`、`MeetingStatusBadge` |

**前端构建命令**（在 `apps/web/Dockerfile` 中已内置）：

```bash
# 本地验证构建
cd apps/web && npm run build
# 确认 dist/ 目录包含 meetings 相关路由
```

---

### 4. Electron 桌面端打包

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 路由 `/meetings`、`/meetings/:id` | **占位就绪** | `apps/electron/src/renderer/App.tsx` 已注册路由，但页面为占位组件 |
| 会议号工具函数 | **就绪** | `apps/electron/src/utils/meeting.ts`（格式化、提取、复制） |
| 复用 Web 端会议页面 | **待完成** | `App.tsx` 中 `MeetingListPage`/`MeetingDetailPage` 仍为 Electron 内部占位实现，注释说明等待 Web 端 REQ-002 完成后集成 |

**注意**：Electron 端会议管理功能当前以占位页面呈现基本 UI，会议列表/详情的完整功能（含 Store 和 API 调用）依赖后续将占位组件替换为 `@web` 包导入。此为已知技术债，不影响 Web 端部署。

---

### 5. WebSocket 会议事件（生产配置）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `MeetingGateway` 启用 | **就绪** | 与后端 HTTP 服务共享同一 Socket.IO 实例，无需独立端口 |
| 命名空间 | **就绪** | `namespace: '/'`，连接地址 `ws://backend:3000` |
| CORS 配置 | **就绪** | `cors.origin: '*'`（生产建议修改为实际域名） |
| `meeting.ended` 事件广播 | **就绪** | `notifyMeetingEnded()` 向 `meeting:{meetingId}` 房间广播 |
| `meeting.participant_joined` 事件广播 | **就绪** | `notifyParticipantJoined()` 向房间广播 |
| 客户端加入房间事件 | **就绪** | 客户端发送 `join_meeting_room` 事件后才接收推送 |

**生产安全建议**：将 `MeetingGateway` 中 `cors.origin` 从 `'*'` 修改为生产域名，防止非授权域跨域建立 WebSocket 连接。

---

## 环境变量确认

**REQ-002 会议功能不需要新增任何环境变量**，完全复用现有配置：

| 环境变量 | 用途 | 来源 |
|----------|------|------|
| `DATABASE_HOST` / `DATABASE_PORT` | 会议数据持久化 | `docker-compose.prod.yml` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | 数据库连接认证 | `docker-compose.prod.yml` |
| `DATABASE_NAME` | 数据库名（`ai_meeting`） | `docker-compose.prod.yml` |
| `JWT_SECRET` | 会议接口 JWT 鉴权 | `docker-compose.prod.yml` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | 限流计数（ThrottlerModule） | `docker-compose.prod.yml` |

---

## 数据库迁移脚本

数据库 DDL 已追加至 `deploy/init-db.sql`，完整内容如下：

```sql
-- 会议表
CREATE TABLE IF NOT EXISTS meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number VARCHAR(9)   NOT NULL,
  title          VARCHAR(100),
  creator_id     UUID         NOT NULL REFERENCES users(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'waiting',
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_meetings_meeting_number UNIQUE (meeting_number)
);

CREATE INDEX IF NOT EXISTS idx_meetings_meeting_number ON meetings(meeting_number);
CREATE INDEX IF NOT EXISTS idx_meetings_creator_id     ON meetings(creator_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status         ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at     ON meetings(created_at DESC);

-- 会议参与者表
CREATE TABLE IF NOT EXISTS meeting_participants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_meeting_participants_meeting_user UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id    ON meeting_participants(user_id);
```

**字段说明对照（Entity vs DDL）**：

| TypeORM Entity 字段 | DDL 列名 | 类型 | 说明 |
|--------------------|----------|------|------|
| `meeting_number` | `meeting_number` | VARCHAR(9) | Entity 定义 length=9，与 DDL 一致 |
| `title` | `title` | VARCHAR(100) | Entity 定义 length=100（API 层校验 maxLength=50） |
| `status` | `status` | VARCHAR(20) | TypeORM enum 存储为字符串（`waiting`/`active`/`ended`） |
| `started_at` | `started_at` | TIMESTAMPTZ | 注意：Entity 使用 `timestamp`，DDL 使用 `TIMESTAMPTZ`（时区安全） |

---

## 多端互通验证计划

### Web 端 ↔ 后端 API 验证项

| 验证项 | 验证方法 | 预期结果 |
|--------|---------|---------|
| 登录后创建会议 | 浏览器访问 `/`，点击"创建会议" | 弹出创建弹窗，成功后显示 9 位会议号 |
| 输入会议号加入会议 | 首页输入框输入 9 位数字 | 跳转至会议详情页 |
| 查看会议列表（我创建的） | 导航至 `/meetings`，切换 Tab | 列表显示当前用户创建的会议 |
| 查看会议列表（我参与的） | 切换至"我参与的" Tab | 列表显示加入的会议（排除自己创建的） |
| 查看会议详情 | 点击会议卡片 | 显示参与者列表、会议号、持续时长 |
| 创建者结束会议 | 详情页点击"结束会议"按钮 | 会议状态变为"已结束"，按钮消失 |
| 非创建者不显示结束按钮 | 以参与者身份登录查看详情 | 无"结束会议"按钮 |
| 已结束会议不可加入 | 尝试加入已结束的会议号 | 提示"该会议已结束" |
| JWT 过期自动刷新 | 等待 1 小时后操作 | 自动调用 `/api/v1/auth/refresh`，无感续期 |

### Electron 端 ↔ 后端 API 验证项

| 验证项 | 验证方法 | 预期结果 |
|--------|---------|---------|
| 桌面端登录 | 启动 Electron 应用，登录账号 | 正常登录，跳转首页 |
| 创建会议（基础路由） | 点击"创建会议"按钮 | 跳转至 `/meetings`（当前为占位页，后续替换 Web 组件后可完整测试） |
| 加入会议（基础路由） | 点击"加入会议"按钮 | 跳转至 `/meetings` |
| 会议号格式化（工具函数） | 在 DevTools Console 调用 `formatMeetingNumber('123456789')` | 返回 `'123-456-789'` |
| 会议号提取（工具函数） | 调用 `extractMeetingNumber('会议号: 123-456-789')` | 返回 `'123456789'` |
| IPC 剪贴板复制 | 调用 `copyMeetingNumber('123456789')` | 系统剪贴板包含 `'123456789'` |
| API 请求到后端 | 检查 Network 面板 | 请求发往 `https://v.ixriver.com/api/v1`（或配置的 `VITE_API_BASE_URL`） |

> **注意**：Electron 端会议管理完整功能（列表/详情）在当前版本以占位组件实现，待 Web 端组件包发布后替换导入。核心 API 调用逻辑与 Web 端共享，验证以 Web 端为主。

### WebSocket 会议结束通知验证项

| 验证项 | 验证步骤 | 预期结果 |
|--------|---------|---------|
| 建立 WebSocket 连接 | 打开会议详情页，检查 Network → WS | 建立连接到 `wss://域名/`，携带 JWT token |
| 加入会议房间 | 页面加载后自动发送 `join_meeting_room` 事件 | 服务端日志显示"客户端 xxx 加入房间 meeting:{meetingId}" |
| 接收会议结束通知 | 创建者结束会议，参与者端查看 | 参与者页面收到 `meeting.ended` 事件，UI 自动更新状态 |
| 接收参与者加入通知 | 有新用户加入会议时 | 房间内其他成员收到 `meeting.participant_joined` 事件 |
| 离开会议房间 | 退出详情页或点击离开 | 发送 `leave_meeting_room` 事件，服务端日志显示离开 |

**Socket.IO 测试命令（手动验证）**：

```javascript
// 在浏览器控制台执行（需已登录获取 token）
const { io } = await import('https://cdn.socket.io/4.7.4/socket.io.esm.min.js');
const socket = io('https://YOUR_DOMAIN', { auth: { token: '你的JWT' } });
socket.emit('join_meeting_room', { meetingId: '你的会议UUID' });
socket.on('meeting.ended', (data) => console.log('会议已结束', data));
```

---

## 回滚方案

### 场景 1：数据库迁移失败

```bash
# 方案 A：删除新表（无数据损失风险，meetings 为新功能表）
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting -c "
  DROP TABLE IF EXISTS meeting_participants;
  DROP TABLE IF EXISTS meetings;
"

# 方案 B：完整数据库回滚至备份
docker-compose -f docker-compose.prod.yml down
# 恢复数据卷备份（需提前备份）
docker run --rm -v ai_meeting_postgres_data:/data -v /opt/backups:/backup \
  alpine tar xzf /backup/postgres_data_YYYYMMDD.tar.gz -C /data
docker-compose -f docker-compose.prod.yml up -d
```

### 场景 2：后端服务启动失败

```bash
# 查看错误日志
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# 回滚到上一个镜像版本
docker-compose -f docker-compose.prod.yml stop backend
docker tag ai-meeting-backend:latest ai-meeting-backend:rollback-$(date +%Y%m%d)
# 重新构建或拉取旧镜像
git checkout HEAD~1 -- apps/backend/
docker-compose -f docker-compose.prod.yml build backend
docker-compose -f docker-compose.prod.yml up -d backend
```

### 场景 3：前端部署后页面异常

```bash
# 查看 Nginx 日志
docker-compose -f docker-compose.prod.yml logs --tail=50 frontend

# 回滚前端镜像
docker-compose -f docker-compose.prod.yml stop frontend
git checkout HEAD~1 -- apps/web/
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

### 场景 4：全量回滚

```bash
# 1. 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 2. 备份当前数据（防止二次损失）
docker run --rm -v ai_meeting_postgres_data:/data -v /opt/backups:/backup \
  alpine tar czf /backup/rollback_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 3. 切换代码到上一个稳定 Tag
git log --oneline -5  # 查看最近提交
git checkout <上一个稳定 commit hash>

# 4. 重新构建并启动
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 5. 验证服务健康
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:3000/api/v1/health
```

### 回滚决策矩阵

| 故障现象 | 优先动作 | 回滚范围 |
|---------|---------|---------|
| 建表失败（meetings 表不存在） | 手动执行 DDL | 仅数据库 |
| 后端 500 错误（会议接口） | 查日志定位，必要时回滚 backend 镜像 | 仅后端容器 |
| 前端页面 404/白屏 | 检查 Nginx 路由配置，回滚前端镜像 | 仅前端容器 |
| WebSocket 无法连接 | 检查后端 CORS 配置，重启 backend | 仅后端容器 |
| 数据库数据异常 | 立即停止写入，从备份恢复 | 数据库 + 后端 |

---

## 部署操作顺序

1. **备份当前数据库**（如非首次部署）

   ```bash
   docker-compose -f docker-compose.prod.yml exec -T postgres \
     pg_dump -U postgres ai_meeting > /opt/backups/pre_REQ002_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **拉取最新代码**

   ```bash
   git pull origin main
   ```

3. **重新构建镜像**

   ```bash
   docker-compose -f docker-compose.prod.yml build --no-cache backend frontend
   ```

4. **重启服务**

   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

   > `init-db.sql` 仅在 postgres 数据卷**首次初始化**时执行。
   > 升级部署需手动运行第 5 步。

5. **（升级部署）手动执行会议表 DDL**

   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting \
     -f /docker-entrypoint-initdb.d/init.sql
   ```

   或仅执行新增表部分：

   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_meeting << 'EOF'
   CREATE TABLE IF NOT EXISTS meetings ( ... );
   CREATE TABLE IF NOT EXISTS meeting_participants ( ... );
   EOF
   ```

6. **健康检查**

   ```bash
   curl http://localhost:3000/api/v1/health
   curl -I http://localhost:8080
   docker-compose -f docker-compose.prod.yml ps
   ```

---

## 已知问题与注意事项

1. **Electron 端会议功能为占位实现**：当前版本 `apps/electron/src/renderer/App.tsx` 中 `MeetingListPage` 和 `MeetingDetailPage` 为内联占位组件，不调用后端 API，不影响 Web 端和后端的部署验收。待后续 Sprint 中将其替换为 `@web` 包导入。

2. **WebSocket CORS 配置**：`MeetingGateway` 当前设置 `cors.origin: '*'`，生产环境应修改为实际域名（如 `https://v.ixriver.com`）。

3. **Entity status 枚举值**：TypeORM Entity 使用的 DB 存储值为小写（`waiting`/`active`/`ended`），而 API 响应通过 `mapStatus()` 函数转换为大写（`WAITING`/`IN_PROGRESS`/`ENDED`）。DDL 中默认值设为 `'waiting'`，与 Entity 定义保持一致。

4. **timestamp vs timestamptz**：Entity 定义使用 `timestamp`（无时区），DDL 迁移脚本使用 `TIMESTAMPTZ`（带时区）。生产环境建议统一使用 `TIMESTAMPTZ`，已在 `deploy/init-db.sql` 中采用。

---

**文档版本**: v1.0
**创建日期**: 2026-02-26
**维护人**: devops-leader

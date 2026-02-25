# REQ-002 会议管理功能技术调研报告

## 文档信息

- **需求编号**: REQ-002
- **需求名称**: 会议管理功能
- **文档类型**: 技术调研报告
- **版本**: v1.0
- **创建日期**: 2026-02-25
- **作者**: architect
- **状态**: 待评审

---

## 1. 调研概述

### 1.1 调研目标

为视频会议系统 MVP v0.1 的会议管理功能确定技术方案，涵盖：
- 9 位唯一数字会议号的生成与唯一性保障
- 数据库表结构设计（meetings、meeting_participants）
- 会议状态机设计（WAITING → IN_PROGRESS → ENDED）
- RESTful API 规划与 REQ-001 鉴权集成
- 会议结束实时通知方案（WebSocket / SSE）
- 创建者权限控制（结束会议）
- 并发安全处理
- 技术选型对比与推荐
- 风险评估

### 1.2 调研背景

当前后端已完成：
- NestJS + DDD 分层架构搭建
- PostgreSQL + TypeORM 集成（User、Meeting 实体已创建）
- Redis Cache Manager 集成
- JWT 认证模块（REQ-001）

`MeetingEntity` 已存在并定义了以下字段：`id`（UUID）、`meeting_number`（9位唯一）、`title`、`creator_id`、`status`（WAITING/ACTIVE/ENDED）、`started_at`、`ended_at`、`created_at`、`updated_at`。

---

## 2. 会议号生成方案

### 2.1 需求分析

- **格式**：9 位纯数字（如 `123456789`）
- **唯一性**：高并发下不能重复
- **可读性**：用户可手动输入，不宜太复杂
- **不可预测性**：避免顺序递增（防止枚举爆破）

### 2.2 方案对比

#### 方案一：UUID 截取 + 数字化

**原理**：生成 UUID，提取其中数字部分，截取 9 位。

```typescript
function generateFromUuid(): string {
  const uuid = randomUUID().replace(/-/g, '');
  // 提取数字部分
  const digits = uuid.replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87));
  return digits.substring(0, 9);
}
```

**优势**：
- 实现简单，无需外部依赖
- UUID 碰撞概率极低

**劣势**：
- UUID 含字母，截取逻辑不直观
- 9 位数字空间（10^9 = 10 亿）内仍有碰撞风险
- 无法保证精确 9 位数字

**结论**：不推荐，逻辑复杂，唯一性不可靠。

---

#### 方案二：雪花算法（Snowflake）

**原理**：64 位 ID = 时间戳（41位）+ 机器ID（10位）+ 序列号（12位），截取末 9 位数字。

```typescript
class SnowflakeIdGenerator {
  private lastTimestamp = -1n;
  private sequence = 0n;
  private readonly machineId: bigint;
  private readonly epoch = 1700000000000n;

  generate(): string {
    let timestamp = BigInt(Date.now()) - this.epoch;
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 0xFFFn;
      if (this.sequence === 0n) {
        while (BigInt(Date.now()) - this.epoch <= this.lastTimestamp) {}
        timestamp = BigInt(Date.now()) - this.epoch;
      }
    } else {
      this.sequence = 0n;
    }
    this.lastTimestamp = timestamp;
    const id = (timestamp << 22n) | (this.machineId << 12n) | this.sequence;
    // 取 10^9 范围内的模，确保 9 位数字
    return String(id % 900000000n + 100000000n); // 100000000 ~ 999999999
  }
}
```

**优势**：
- 单节点内绝对唯一，无需数据库
- 高性能（每秒 4096 个/节点）
- 趋势递增，有利于数据库索引

**劣势**：
- 截取为 9 位数字后会丢失分布式唯一性
- 多节点部署需要机器 ID 分配机制
- 时钟回拨问题需要额外处理

**结论**：单节点 MVP 阶段可用，但截取为 9 位后需配合数据库唯一约束。

---

#### 方案三：随机数 + 数据库唯一约束（推荐）✅

**原理**：生成 [100000000, 999999999] 范围内的随机 9 位数字，配合数据库唯一索引，冲突时重试（最多 5 次）。

```typescript
async function generateMeetingNumber(repo: MeetingRepository): Promise<string> {
  const MAX_RETRY = 5;
  for (let i = 0; i < MAX_RETRY; i++) {
    // 生成 100000000 ~ 999999999 的随机数
    const num = Math.floor(Math.random() * 900000000) + 100000000;
    const meetingNumber = String(num);

    const exists = await repo.existsByMeetingNumber(meetingNumber);
    if (!exists) {
      return meetingNumber;
    }
  }
  throw new Error('会议号生成失败，请重试');
}
```

**优势**：
- 实现最简单，直观易懂
- 9 位空间 9 亿个，在 MVP 阶段（百万量级会议记录以下）碰撞率极低
- 数据库唯一约束兜底，绝对不会写入重复数据
- 号码不可预测，安全性好

**劣势**：
- 每次生成需要查询数据库（1次 SELECT）
- 理论上碰撞率随会议数量增长而升高（但 9 亿空间足够 MVP）
- 高并发写入时有极小概率需要重试

**碰撞率分析**：
- 假设已有 100 万条会议记录（远超 MVP 规模）
- 碰撞概率 = 100万 / 9亿 ≈ 0.11%
- 5 次重试后失败概率 ≈ (0.11%)^5 ≈ 可忽略

**结论**：MVP 阶段推荐，简单可靠，唯一性由数据库唯一索引保证。

---

#### 方案四：Redis 原子计数器 + 映射

**原理**：Redis `INCR` 生成自增序号，通过洗牌算法映射为随机外观的 9 位数字。

**优势**：
- 天然唯一，无需重试
- 高性能

**劣势**：
- 增加 Redis 依赖复杂性
- 洗牌映射逻辑复杂
- Redis 故障时无法生成会议号

**结论**：过度设计，MVP 阶段不推荐。

---

### 2.3 选型决策

| 方案 | 唯一性 | 实现复杂度 | 性能 | 可预测性 | 推荐度 |
|------|--------|-----------|------|---------|--------|
| UUID 截取 | 低 | 中 | 高 | 低 | ❌ |
| 雪花算法 | 高（单节点） | 高 | 高 | 中 | 不推荐 |
| **随机数+唯一约束** | 高 | 低 | 中 | 低 | ✅ 推荐 |
| Redis 计数器 | 高 | 高 | 高 | 中 | 不推荐 |

**选型**：方案三（随机数 + 数据库唯一约束）✅

**并发安全补充**：数据库 `UNIQUE` 索引保证最终唯一性；若并发插入冲突，捕获 `UniqueConstraintViolation` 异常并重试，无需分布式锁。

---

## 3. 数据库表设计

### 3.1 meetings 表

现有 `MeetingEntity` 已涵盖核心字段，以下为完整 SQL 定义（与 TypeORM 实体对应）：

```sql
CREATE TABLE meetings (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number VARCHAR(9)  NOT NULL,          -- 9 位数字会议号
  title        VARCHAR(100) NULL,               -- 会议标题（可选）
  creator_id   UUID         NOT NULL,           -- 创建者用户 ID
  status       VARCHAR(20)  NOT NULL DEFAULT 'waiting',  -- waiting|in_progress|ended
  started_at   TIMESTAMP    NULL,               -- 会议开始时间
  ended_at     TIMESTAMP    NULL,               -- 会议结束时间
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_meetings_creator
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_meetings_meeting_number
    UNIQUE (meeting_number),
  CONSTRAINT chk_meetings_status
    CHECK (status IN ('waiting', 'in_progress', 'ended'))
);

CREATE INDEX idx_meetings_meeting_number ON meetings(meeting_number);
CREATE INDEX idx_meetings_creator_id ON meetings(creator_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
```

**注意事项**：
- `status` 使用 VARCHAR + CHECK 约束（与 TypeORM `enum` 类型对应）
- `meeting_number` 设置唯一索引，兼作快速查询索引
- 创建者删除时级联删除会议（MVP 阶段简化处理）

---

### 3.2 meeting_participants 表

记录参与者加入/离开会议的历史，支持同一用户多次进出。

```sql
CREATE TABLE meeting_participants (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID      NOT NULL,              -- 关联会议
  user_id      UUID      NOT NULL,              -- 参与者用户 ID
  joined_at    TIMESTAMP NOT NULL DEFAULT NOW(),-- 加入时间
  left_at      TIMESTAMP NULL,                  -- 离开时间（NULL 表示仍在会议中）
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mp_meeting
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_mp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 查询某会议当前在线参与者（left_at IS NULL）
CREATE INDEX idx_mp_meeting_id_left_at
  ON meeting_participants(meeting_id, left_at);

-- 查询某用户当前所在会议
CREATE INDEX idx_mp_user_id_left_at
  ON meeting_participants(user_id, left_at);

-- 查询某会议完整历史
CREATE INDEX idx_mp_meeting_id_joined_at
  ON meeting_participants(meeting_id, joined_at DESC);
```

**设计要点**：
- 允许同一用户多次加入（断线重连场景），每次生成新记录
- `left_at IS NULL` 表示当前在线，`left_at IS NOT NULL` 表示已离开
- 不使用唯一约束 `(meeting_id, user_id)`，允许同一用户多次进出
- 会议结束时批量更新 `left_at = NOW()` 标记所有在线参与者离开

---

### 3.3 表关系图

```
users (id)
  ├── meetings.creator_id  (1:N, 一个用户可创建多个会议)
  └── meeting_participants.user_id (1:N)

meetings (id)
  └── meeting_participants.meeting_id (1:N, 一个会议有多个参与记录)
```

---

### 3.4 字段说明

**meetings 表关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 内部主键，用于关联查询 |
| meeting_number | VARCHAR(9) | 对外展示的 9 位会议号，用户输入加入 |
| title | VARCHAR(100) | 会议标题，选填 |
| creator_id | UUID | 创建者，拥有结束会议权限 |
| status | ENUM | 状态机：waiting/in_progress/ended |
| started_at | TIMESTAMP | 第一个参与者加入时记录 |
| ended_at | TIMESTAMP | 创建者结束会议时记录 |

**meeting_participants 表关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 参与记录主键 |
| meeting_id | UUID | 关联会议 |
| user_id | UUID | 参与者 |
| joined_at | TIMESTAMP | 加入时间 |
| left_at | TIMESTAMP NULL | 离开时间，NULL=在线中 |

---

## 4. 会议状态机设计

### 4.1 状态定义

```
WAITING     - 已创建，等待参与者加入
IN_PROGRESS - 至少一名参与者已加入，会议进行中
ENDED       - 创建者主动结束，或系统自动结束
```

**注意**：现有 `MeetingEntity` 使用的是 `WAITING/ACTIVE/ENDED`，本文档建议统一为 `WAITING/IN_PROGRESS/ENDED`（更语义化），需与团队确认。

### 4.2 状态转换规则

```
         创建会议
           ↓
        WAITING
           │
           │ [事件: 首个参与者加入]
           ↓
       IN_PROGRESS
           │
           ├── [事件: 创建者调用结束API] ──→ ENDED
           │
           └── [事件: 所有参与者离开后超时] ──→ ENDED (可选，Phase 2)
```

| 当前状态 | 触发事件 | 目标状态 | 执行操作 |
|---------|---------|---------|---------|
| WAITING | 首个用户加入 | IN_PROGRESS | 设置 `started_at = NOW()` |
| IN_PROGRESS | 创建者结束会议 | ENDED | 设置 `ended_at = NOW()`，通知所有参与者 |
| ENDED | 任何操作 | - | 拒绝，返回 `MeetingAlreadyEndedError` |
| WAITING | 创建者结束会议 | ENDED | 允许（直接结束未开始的会议） |

### 4.3 状态转换实现

**领域层**（meeting.entity.ts 扩展）：

```typescript
// domain/meeting/meeting.entity.ts
export class Meeting {
  // ... 字段定义

  join(userId: string): void {
    if (this.status === MeetingStatus.ENDED) {
      throw new MeetingEndedError('会议已结束，无法加入');
    }
    if (this.status === MeetingStatus.WAITING) {
      // 首个参与者加入，状态变为 IN_PROGRESS
      this.status = MeetingStatus.IN_PROGRESS;
      this.started_at = new Date();
    }
    // 添加参与记录（由应用层处理）
  }

  end(requestUserId: string): void {
    if (this.status === MeetingStatus.ENDED) {
      throw new MeetingEndedError('会议已结束');
    }
    if (this.creator_id !== requestUserId) {
      throw new ForbiddenError('只有创建者可以结束会议');
    }
    this.status = MeetingStatus.ENDED;
    this.ended_at = new Date();
  }
}
```

### 4.4 并发安全的状态转换

使用数据库乐观锁或悲观锁防止并发状态转换冲突：

```typescript
// 使用 PostgreSQL SELECT FOR UPDATE（悲观锁）
// 在同一事务内加锁、修改、提交
async joinMeeting(meetingNumber: string, userId: string): Promise<void> {
  await this.db.transaction(async (trx) => {
    // 加行锁，防止并发修改同一行
    const meeting = await trx
      .createQueryBuilder(MeetingEntity, 'm')
      .where('m.meeting_number = :num', { num: meetingNumber })
      .setLock('pessimistic_write')
      .getOneOrFail();

    // 执行领域逻辑
    meeting.join(userId);

    // 保存修改
    await trx.save(meeting);

    // 插入参与记录
    await trx.save(MeetingParticipantEntity, {
      meeting_id: meeting.id,
      user_id: userId,
      joined_at: new Date(),
    });
  });
}
```

---

## 5. API 设计思路

### 5.1 RESTful 端点规划

遵循 REQ-001 API 规范（统一响应格式、5位错误码），基础路径：`/v1/meetings`。

| 方法 | 路径 | 描述 | 认证 | 权限 |
|------|------|------|------|------|
| POST | /v1/meetings | 创建会议 | 必须 | 已登录用户 |
| GET | /v1/meetings/:meetingNumber | 获取会议详情（按会议号） | 必须 | 任意已登录用户 |
| POST | /v1/meetings/:meetingNumber/join | 加入会议 | 必须 | 任意已登录用户 |
| POST | /v1/meetings/:meetingNumber/leave | 离开会议 | 必须 | 当前参与者 |
| POST | /v1/meetings/:meetingNumber/end | 结束会议 | 必须 | 仅创建者 |
| GET | /v1/meetings/:meetingNumber/participants | 获取参与者列表 | 必须 | 任意已登录用户 |

**URL 设计说明**：
- 使用 `meetingNumber`（9 位数字）作为 URL 参数，而非内部 UUID
- 用户看到的始终是会议号，与 UI 一致
- UUID 仅用于内部数据库关联

### 5.2 与 REQ-001 鉴权集成

所有会议接口均需要 JWT Access Token 认证，复用现有 `JwtAuthGuard`：

```typescript
// meeting.controller.ts
@Controller('meetings')
@UseGuards(JwtAuthGuard)  // 复用 REQ-001 JWT Guard
export class MeetingController {

  @Post()
  async createMeeting(
    @CurrentUser() user: JwtPayload,  // 从 JWT 中获取用户信息
    @Body() dto: CreateMeetingDto
  ) { ... }

  @Post(':meetingNumber/end')
  async endMeeting(
    @CurrentUser() user: JwtPayload,
    @Param('meetingNumber') meetingNumber: string
  ) {
    // 权限检查：仅允许创建者结束（在 Use Case 中验证）
    ...
  }
}
```

**JWT Payload 复用**（REQ-001 定义）：
```typescript
interface JwtPayload {
  sub: string;    // user_id
  email: string;
  nickname: string;
  roles: string[];
}
```

### 5.3 响应格式（与 REQ-001 保持一致）

**成功响应**：
```json
{
  "code": 0,
  "message": "成功",
  "data": { ... }
}
```

**错误响应（5 位错误码规范）**：

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| 40401 | 404 | 会议不存在 |
| 40301 | 403 | 无权限结束会议（非创建者） |
| 40902 | 409 | 会议已结束，无法加入 |
| 40903 | 409 | 会议号生成失败 |
| 40001 | 400 | 请求参数错误 |

---

## 6. 实时通知方案

### 6.1 需求分析

当创建者调用"结束会议"时，需要通知所有当前在线参与者：
- 参与者收到通知后停止媒体流、跳转到会议结束页

### 6.2 方案对比

#### 方案一：WebSocket（推荐）✅

**原理**：客户端加入会议时建立 WebSocket 长连接，服务端可主动推送事件。

```typescript
// 服务端推送
@WebSocketGateway({ namespace: '/meeting' })
export class MeetingGateway {
  notifyMeetingEnded(meetingId: string): void {
    this.server
      .to(`meeting:${meetingId}`)  // 向该会议房间广播
      .emit('meeting:ended', { meetingId, endedAt: new Date() });
  }
}
```

```typescript
// 客户端监听
socket.on('meeting:ended', ({ meetingId }) => {
  // 停止媒体流，跳转结束页
});
```

**优势**：
- 双向通信，后续可扩展（如聊天、在线状态）
- 浏览器原生支持，延迟低
- NestJS `@WebSocketGateway` 与现有架构无缝集成
- 与信令服务天然融合（Phase 2 WebRTC 信令使用同一连接）

**劣势**：
- 长连接消耗服务器资源（每连接约 64KB 内存）
- 多节点部署时需要 Redis Pub/Sub 跨节点广播

**MVP 单节点方案**（无需 Redis Pub/Sub）：
```typescript
@WebSocketGateway({ namespace: '/meeting' })
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // 在内存中维护 meetingId -> Set<socketId> 映射
  private meetingRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket): void {
    const meetingId = client.handshake.query.meetingId as string;
    if (meetingId) {
      client.join(`meeting:${meetingId}`);
    }
  }

  notifyEnded(meetingId: string): void {
    this.server.to(`meeting:${meetingId}`).emit('meeting:ended', {
      meetingId,
      endedAt: new Date().toISOString(),
    });
  }
}
```

**多节点扩展方案**（Phase 2）：接入 `@socket.io/redis-adapter`，使用现有 Redis 实现跨节点广播。

---

#### 方案二：Server-Sent Events（SSE）

**原理**：HTTP 单向推送，客户端订阅 `/meetings/:id/events` 流。

```typescript
@Get(':meetingId/events')
@UseGuards(JwtAuthGuard)
@Sse()
meetingEvents(@Param('meetingId') meetingId: string): Observable<MessageEvent> {
  return this.meetingEventService.getEventStream(meetingId);
}
```

**优势**：
- 基于 HTTP，无需额外协议
- 实现简单，NestJS 内置 `@Sse()` 支持
- 自动重连机制

**劣势**：
- 单向推送，无法接收客户端消息
- 每个订阅建立独立 HTTP 连接，HTTP/1.1 下每域名 6 个连接限制
- 不能与 WebRTC 信令共享连接，增加资源消耗

**结论**：功能受限，后续无法扩展为信令服务，不推荐。

---

#### 方案三：轮询（Polling）

**原理**：客户端定时请求 `GET /meetings/:id/status`。

**劣势**：
- 延迟高（最多等一个轮询周期）
- 浪费服务器资源（大量无效请求）
- 不符合实时通信要求

**结论**：不适用于实时场景，直接排除。

---

### 6.3 选型决策

| 维度 | WebSocket | SSE | 轮询 |
|------|-----------|-----|------|
| 实时性 | 高 | 高 | 低 |
| 服务器资源 | 中 | 中 | 高（无效请求） |
| 扩展性 | 高（信令复用） | 低 | 低 |
| 实现复杂度 | 中 | 低 | 低 |
| 双向通信 | 支持 | 不支持 | 不支持 |

**选型**：WebSocket ✅

**理由**：与 Phase 2 WebRTC 信令服务共享连接，避免重复建连；NestJS 原生支持，与现有架构一致。

---

## 7. 权限控制

### 7.1 创建者特权设计

**权限规则**：
- 任何已登录用户均可创建会议
- 任何已登录用户均可加入（WAITING/IN_PROGRESS 状态的）会议
- 只有 `creator_id == currentUserId` 的用户可以结束会议

### 7.2 实现方案

**应用层权限检查**（Use Case 层）：

```typescript
// application/use-cases/meeting/end-meeting.use-case.ts
export class EndMeetingUseCase {
  async execute(meetingNumber: string, requestUserId: string): Promise<void> {
    const meeting = await this.meetingRepo.findByMeetingNumber(meetingNumber);
    if (!meeting) {
      throw new MeetingNotFoundError();
    }

    // 权限检查：只有创建者可结束
    if (meeting.creator_id !== requestUserId) {
      throw new ForbiddenError('只有会议创建者可以结束会议');
    }

    // 领域逻辑：状态转换
    meeting.end(requestUserId);

    await this.meetingRepo.save(meeting);

    // 通知所有参与者
    await this.meetingGateway.notifyEnded(meeting.id);

    // 批量标记参与者已离开
    await this.participantRepo.markAllLeft(meeting.id);
  }
}
```

**NestJS Guard 方案（可选扩展）**：

```typescript
// common/guards/meeting-creator.guard.ts
@Injectable()
export class MeetingCreatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.sub;
    const meetingNumber = request.params.meetingNumber;

    const meeting = await this.meetingRepo.findByMeetingNumber(meetingNumber);
    if (!meeting) throw new NotFoundException();

    return meeting.creator_id === userId;
  }
}
```

**推荐**：MVP 阶段在 Use Case 层做权限检查，逻辑清晰，无需额外 Guard。

---

## 8. 并发安全

### 8.1 并发场景分析

| 场景 | 风险 | 解决方案 |
|------|------|---------|
| 多人同时加入同一会议 | 状态转换竞态（WAITING→IN_PROGRESS 多次触发） | 数据库行锁（SELECT FOR UPDATE） |
| 创建者结束会议同时有人加入 | 加入已结束的会议 | 行锁 + 状态检查 |
| 会议号生成并发写入 | 唯一约束冲突 | 数据库 UNIQUE 约束 + 重试 |
| 同一用户多次点击加入 | 重复参与记录 | 检查 `left_at IS NULL` 的记录 |

### 8.2 数据库行锁方案

核心操作（加入/结束会议）均在数据库事务内执行 `SELECT FOR UPDATE`：

```typescript
// infrastructure/database/repositories/meeting.repository.impl.ts
async findByMeetingNumberForUpdate(
  meetingNumber: string,
  trx: EntityManager
): Promise<MeetingEntity> {
  return trx
    .createQueryBuilder(MeetingEntity, 'm')
    .where('m.meeting_number = :num', { num: meetingNumber })
    .setLock('pessimistic_write')  // FOR UPDATE
    .getOneOrFail();
}
```

**事务边界设计**：
- 加入会议：一个事务内完成（锁会议行 + 修改状态 + 插入参与记录）
- 结束会议：一个事务内完成（锁会议行 + 修改状态 + 批量更新参与者 + 触发通知）

### 8.3 重复加入处理

```typescript
// 检查用户是否已在会议中（left_at IS NULL）
async isUserInMeeting(meetingId: string, userId: string): Promise<boolean> {
  const count = await this.participantRepo.count({
    where: {
      meeting_id: meetingId,
      user_id: userId,
      left_at: IsNull(),  // 仍在会议中
    },
  });
  return count > 0;
}
```

### 8.4 会议号生成并发处理

```typescript
async createMeeting(dto: CreateMeetingDto, creatorId: string): Promise<Meeting> {
  const MAX_RETRY = 5;
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const meetingNumber = this.generateRandomMeetingNumber();
    try {
      return await this.meetingRepo.createWithMeetingNumber(meetingNumber, dto, creatorId);
    } catch (e) {
      if (isUniqueConstraintViolation(e)) {
        // 并发冲突，重试
        continue;
      }
      throw e;
    }
  }
  throw new ServiceUnavailableError('系统繁忙，请稍后重试');
}

private generateRandomMeetingNumber(): string {
  return String(Math.floor(Math.random() * 900000000) + 100000000);
}
```

---

## 9. 技术选型对比与推荐

### 9.1 汇总

| 技术点 | 候选方案 | 推荐方案 | 理由 |
|-------|---------|---------|------|
| 会议号生成 | UUID截取/雪花/随机+唯一约束/Redis计数器 | 随机数+数据库唯一约束 | 简单可靠，9亿空间足够MVP |
| 数据库 | PostgreSQL（已定） | PostgreSQL | 现有基础设施，无需变更 |
| 并发控制 | 乐观锁/悲观锁/Redis分布式锁 | SELECT FOR UPDATE（悲观锁） | 简单有效，适合低并发MVP |
| 实时通知 | WebSocket/SSE/轮询 | WebSocket | 扩展性强，与信令服务复用 |
| 权限验证 | Guard/Use Case层 | Use Case层 | 逻辑清晰，测试简单 |
| ORM | TypeORM（已定） | TypeORM | 现有基础设施 |

### 9.2 MVP 推荐架构

```
MeetingController (api/controllers/meeting/)
    ↓ [JwtAuthGuard]
CreateMeetingUseCase / JoinMeetingUseCase / EndMeetingUseCase
    ↓
MeetingEntity (领域模型，含状态转换逻辑)
    ↓
MeetingRepositoryImpl (基础设施层，TypeORM)
    + MeetingGateway (WebSocket 通知)
    ↓
PostgreSQL (meetings + meeting_participants)
Redis (WebSocket 多节点扩展，Phase 2)
```

---

## 10. 风险评估

### 10.1 技术风险

| 风险 | 严重程度 | 概率 | 应对措施 |
|------|---------|------|---------|
| 会议号碰撞（高并发） | 中 | 低（9亿空间） | 重试机制 + 数据库唯一约束兜底 |
| WebSocket 连接泄露 | 中 | 低 | 心跳检测 + 离开/结束时主动断开 |
| 状态转换竞态 | 高 | 低 | SELECT FOR UPDATE 行锁 |
| 并发结束会议 | 中 | 低 | 行锁保证只有一次成功 |
| 会议结束通知丢失 | 中 | 中 | 客户端定期轮询会议状态（降级方案） |

### 10.2 性能风险

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 大量 WebSocket 连接 | 内存/CPU 压力 | MVP 单节点可支撑 1000+ 并发；超出后接入 Redis Adapter |
| 会议号生成 SELECT 查询 | 轻微延迟 | Redis 缓存已有会议号集合（Phase 2 优化） |
| meeting_participants 表增长 | 查询变慢 | 定期归档历史记录；`left_at` 索引加速在线查询 |

### 10.3 状态枚举一致性风险

**当前问题**：现有 `MeetingEntity` 使用 `WAITING/ACTIVE/ENDED`，需求文档建议 `WAITING/IN_PROGRESS/ENDED`。

**影响**：如果改变枚举值，需要数据库迁移。

**建议**：在 REQ-002 评审时确认最终状态名称，统一后执行迁移。若已有数据，优先保留 `ACTIVE` 以避免迁移风险，通过别名处理。

---

## 11. 技术选型总结

| 技术点 | 方案 | 理由 |
|-------|------|------|
| 会议号生成 | 随机数（100000000~999999999）+ 数据库 UNIQUE 约束 | 简单可靠，唯一性有保障 |
| 参与记录设计 | 允许多次进出，`left_at IS NULL` 表示在线 | 支持断线重连场景 |
| 状态机 | WAITING → IN_PROGRESS → ENDED，领域层封装 | 状态转换逻辑内聚在实体中 |
| 并发控制 | PostgreSQL SELECT FOR UPDATE | 无需引入额外中间件 |
| 会议号并发 | 捕获 UniqueConstraintViolation 重试 | 简单有效，零额外依赖 |
| 实时通知 | NestJS WebSocket Gateway | 与 Phase 2 信令服务复用 |
| 权限控制 | Use Case 层检查 creator_id | 逻辑清晰，易于测试 |
| API 鉴权 | 复用 REQ-001 JwtAuthGuard | 无需额外实现 |

---

## 12. 参考资料

### 12.1 现有代码

- 后端实体：`apps/backend/src/infrastructure/database/entities/meeting.entity.ts`
- 用户实体：`apps/backend/src/infrastructure/database/entities/user.entity.ts`
- JWT Guard：`apps/backend/src/common/guards/jwt-auth.guard.ts`
- 后端架构：`docs/architecture/backend.md`
- REQ-001 技术调研：`docs/versions/v0.1/requirements/REQ-001/tech_research.md`
- REQ-001 API 契约：`docs/versions/v0.1/requirements/REQ-001/api_contract.md`

### 12.2 技术文档

- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [TypeORM Transactions](https://typeorm.io/transactions)
- [PostgreSQL SELECT FOR UPDATE](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)

---

**文档版本**: v1.0
**创建日期**: 2026-02-25
**审核状态**: 待评审
**维护人**: architect

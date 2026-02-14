# 后端架构设计

## 1. 背景与目标

### 1.1 业务背景
后端系统需要处理用户管理、会议管理、实时通信、录制存储等核心业务逻辑,同时保证代码的可维护性和可扩展性。

### 1.2 技术目标
- **清晰的分层架构**：业务逻辑与技术实现解耦
- **领域驱动设计**：业务概念与代码模型一致
- **高内聚低耦合**：模块边界清晰，依赖关系简单
- **可测试性**：单元测试覆盖率 >80%

### 1.3 约束条件
- MVP 阶段：避免过度设计，优先实现核心功能
- 团队熟悉度：选择团队熟悉的技术栈
- 演进性：预留微服务化空间

---

## 2. 方案调研

### 2.1 分层架构

#### 2.1.1 传统三层架构

```
表现层 (Presentation Layer)
    ↓
业务逻辑层 (Business Logic Layer)
    ↓
数据访问层 (Data Access Layer)
```

**优势**：
- 简单易懂
- 快速开发

**劣势**：
- 业务逻辑容易泄漏到表现层
- 数据模型与领域模型混淆
- 难以测试（依赖数据库）

#### 2.1.2 Clean Architecture（整洁架构）

```
┌─────────────────────────────────┐
│    表现层 (Controllers/API)      │
├─────────────────────────────────┤
│    应用层 (Use Cases)            │
├─────────────────────────────────┤
│    领域层 (Domain Model)         │
├─────────────────────────────────┤
│    基础设施层 (DB/外部服务)       │
└─────────────────────────────────┘

依赖方向：外层 → 内层
```

**优势**：
- 业务逻辑独立于框架和数据库
- 易于测试（依赖注入）
- 清晰的依赖关系

**劣势**：
- 学习曲线陡峭
- 代码量较多（适配器模式）

#### 2.1.3 DDD 分层架构（推荐）

```
用户接口层 (User Interface)
  ↓
应用层 (Application)
  ↓
领域层 (Domain)
  ↓
基础设施层 (Infrastructure)
```

**核心原则**：
- **领域层**：核心业务逻辑，不依赖外部
- **应用层**：协调领域对象，编排业务流程
- **基础设施层**：技术实现（数据库、缓存、消息队列）
- **用户接口层**：API、WebSocket 等入口

---

### 2.2 DDD 核心概念

#### 2.2.1 实体 (Entity)

具有唯一标识的对象，生命周期内标识不变。

```typescript
class User {
  id: string;           // 唯一标识
  email: string;
  password: string;
  profile: UserProfile;

  // 领域行为
  changePassword(newPassword: string): void {
    // 密码强度校验
    // 加密
    this.password = hash(newPassword);
  }
}
```

#### 2.2.2 值对象 (Value Object)

无标识，通过属性值比较相等性，不可变。

```typescript
class Email {
  constructor(private readonly value: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.value.includes('@')) {
      throw new Error('Invalid email');
    }
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

#### 2.2.3 聚合 (Aggregate)

一组相关对象的集合，通过聚合根访问。

```typescript
class Meeting {  // 聚合根
  id: string;
  title: string;
  participants: Participant[];  // 聚合内部对象

  // 通过聚合根维护一致性
  addParticipant(user: User): void {
    if (this.participants.length >= this.maxParticipants) {
      throw new Error('Meeting is full');
    }
    this.participants.push(new Participant(user));
  }
}
```

#### 2.2.4 仓储 (Repository)

封装数据访问逻辑，提供领域对象的查询和持久化。

```typescript
interface MeetingRepository {
  findById(id: string): Promise<Meeting>;
  save(meeting: Meeting): Promise<void>;
  findByUserId(userId: string): Promise<Meeting[]>;
}
```

#### 2.2.5 领域服务 (Domain Service)

无状态的领域逻辑，不属于任何实体或值对象。

```typescript
class MeetingScheduleService {
  checkConflict(
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // 检查用户是否有时间冲突的会议
  }
}
```

#### 2.2.6 应用服务 (Application Service)

协调领域对象，编排业务流程。

```typescript
class CreateMeetingUseCase {
  constructor(
    private meetingRepo: MeetingRepository,
    private scheduleService: MeetingScheduleService,
    private notificationService: NotificationService
  ) {}

  async execute(command: CreateMeetingCommand): Promise<Meeting> {
    // 1. 检查冲突
    const hasConflict = await this.scheduleService.checkConflict(...);
    if (hasConflict) throw new Error('Time conflict');

    // 2. 创建会议
    const meeting = new Meeting(command);
    await this.meetingRepo.save(meeting);

    // 3. 发送通知
    await this.notificationService.send(meeting);

    return meeting;
  }
}
```

---

### 2.3 服务治理

#### 2.3.1 服务注册与发现

| 方案 | 优势 | 劣势 | 适用场景 |
|-----|------|------|---------|
| **Consul** | 健康检查、KV 存储 | 需独立部署 | 生产环境 |
| **Eureka** | 成熟（Spring Cloud） | 不再维护 | - |
| **Kubernetes Service** | 云原生 | 需 K8s | 云部署 |

**MVP 推荐**：硬编码服务地址（配置文件）
**长期方案**：Kubernetes Service

#### 2.3.2 配置中心

| 方案 | 优势 | 劣势 |
|-----|------|------|
| **Apollo** | 功能全面 | 重量级 |
| **Nacos** | 阿里开源 | 社区较小 |
| **Consul KV** | 轻量级 | 功能基础 |

**MVP 推荐**：环境变量 + .env 文件
**长期方案**：Consul KV

#### 2.3.3 分布式追踪

| 方案 | 优势 | 劣势 |
|-----|------|------|
| **Jaeger** | CNCF 项目 | 需独立部署 |
| **Zipkin** | 成熟稳定 | UI 较弱 |
| **SkyWalking** | 国内流行 | 学习曲线陡 |

**MVP 推荐**：结构化日志（JSON）
**长期方案**：Jaeger

---

### 2.4 数据一致性

#### 2.4.1 本地事务（ACID）

**适用场景**：单体应用，数据在同一数据库

```typescript
async createMeetingWithParticipants(meeting: Meeting) {
  await this.db.transaction(async (trx) => {
    await trx.insert('meetings', meeting);
    await trx.insert('participants', meeting.participants);
  });
}
```

#### 2.4.2 Saga 模式（最终一致性）

**适用场景**：微服务，跨服务事务

**编排式 Saga（推荐）**：
```
创建会议 → 发送通知 → 预扣费（失败则回滚）
   ↓ 成功     ↓ 成功      ↓ 失败
  提交      提交        补偿（撤销会议、撤销通知）
```

**实现方式**：
```typescript
class CreateMeetingSaga {
  async execute(command: CreateMeetingCommand) {
    const meeting = await this.meetingService.create(command);
    try {
      await this.notificationService.send(meeting.id);
      await this.billingService.charge(command.userId);
    } catch (error) {
      // 补偿：删除会议
      await this.meetingService.delete(meeting.id);
      throw error;
    }
  }
}
```

#### 2.4.3 事件溯源（Event Sourcing）

**原理**：不存储最终状态，存储所有事件，通过重放事件恢复状态

**优势**：
- 完整的审计日志
- 可回溯到任意时间点

**劣势**：
- 复杂度高
- 查询困难（需 CQRS）

**适用场景**：
- 金融系统（审计要求高）
- 协作系统（需要版本历史）

**MVP 推荐**：本地事务 + Saga 模式
**长期方案**：根据需要引入事件溯源

---

### 2.5 高并发设计

#### 2.5.1 读写分离

```
写请求 → Master DB
读请求 → Slave DB (负载均衡)
```

**注意事项**：
- 主从延迟（通常 <100ms）
- 写后读问题（读主库或缓存）

#### 2.5.2 消息队列削峰

```
高峰期请求 → 写入队列 → 消费者异步处理
```

**适用场景**：
- 邮件发送
- 录制转码
- 数据统计

#### 2.5.3 缓存策略

**缓存更新策略对比**：

| 策略 | 说明 | 优势 | 劣势 |
|-----|------|------|------|
| **Cache-Aside** | 读先查缓存，写先更新 DB 再删缓存 | 简单 | 可能缓存穿透 |
| **Read-Through** | 缓存负责加载数据 | 简化业务代码 | 需缓存层支持 |
| **Write-Through** | 同时写缓存和 DB | 一致性好 | 写延迟高 |
| **Write-Behind** | 先写缓存，异步写 DB | 写性能高 | 可能丢失数据 |

**MVP 推荐**：Cache-Aside

**缓存击穿防护**：
```typescript
async getUserById(id: string) {
  // 1. 查缓存
  let user = await redis.get(`user:${id}`);
  if (user) return user;

  // 2. 分布式锁防止击穿
  const lock = await redis.lock(`lock:user:${id}`, 5000);
  try {
    // 3. 双重检查
    user = await redis.get(`user:${id}`);
    if (user) return user;

    // 4. 查数据库
    user = await db.findById(id);

    // 5. 写缓存
    await redis.set(`user:${id}`, user, 3600);

    return user;
  } finally {
    await lock.release();
  }
}
```

---

## 3. 选型决策

### 3.1 MVP 推荐方案

#### 3.1.1 分层架构

```
open-meeting-backend/
├── src/
│   ├── api/                    # 用户接口层
│   │   ├── controllers/        # REST API
│   │   ├── websocket/          # WebSocket
│   │   └── middleware/         # 认证、日志、错误处理
│   │
│   ├── application/            # 应用层
│   │   ├── use-cases/          # 业务用例
│   │   │   ├── user/
│   │   │   │   ├── register-user.use-case.ts
│   │   │   │   └── login-user.use-case.ts
│   │   │   └── meeting/
│   │   │       ├── create-meeting.use-case.ts
│   │   │       └── join-meeting.use-case.ts
│   │   ├── dto/                # 数据传输对象
│   │   └── services/           # 应用服务
│   │
│   ├── domain/                 # 领域层
│   │   ├── user/
│   │   │   ├── user.entity.ts
│   │   │   ├── user.repository.ts (接口)
│   │   │   └── user-profile.value-object.ts
│   │   ├── meeting/
│   │   │   ├── meeting.entity.ts
│   │   │   ├── meeting.repository.ts
│   │   │   ├── participant.entity.ts
│   │   │   └── meeting-schedule.service.ts
│   │   └── shared/
│   │       ├── base.entity.ts
│   │       └── value-objects/
│   │
│   └── infrastructure/         # 基础设施层
│       ├── database/
│       │   ├── repositories/   # 仓储实现
│       │   │   ├── user.repository.impl.ts
│       │   │   └── meeting.repository.impl.ts
│       │   └── migrations/
│       ├── cache/
│       │   └── redis.service.ts
│       ├── messaging/
│       │   └── rabbitmq.service.ts
│       └── external/
│           ├── email.service.ts
│           └── sms.service.ts
│
└── tests/
    ├── unit/
    └── integration/
```

#### 3.1.2 技术栈选型

**后端框架**：
- **Node.js + NestJS**（推荐）
  - 理由：TypeScript、依赖注入、模块化、文档完善
  - 适合：快速开发、团队熟悉 TypeScript
- **Go + Gin**
  - 理由：高性能、并发优势
  - 适合：高性能要求、团队熟悉 Go

**ORM**：
- **TypeORM**（NestJS）
- **Prisma**（现代、类型安全）
- **GORM**（Go）

**验证库**：
- **class-validator** (NestJS)
- **Joi** (Node.js)

**日志库**：
- **Winston** (Node.js)
- **Zap** (Go)

---

### 3.2 演进路线

#### 3.2.1 阶段 1：MVP（0-6 个月）
- **架构**：DDD 分层，模块化单体
- **数据一致性**：本地事务
- **缓存**：Redis Cache-Aside
- **异步任务**：Redis Pub/Sub

#### 3.2.2 阶段 2：微服务拆分（6-12 个月）
- **服务拆分**：按领域拆分（用户、会议、信令、媒体）
- **数据一致性**：Saga 模式
- **服务发现**：Consul
- **异步任务**：RabbitMQ

#### 3.2.3 阶段 3：服务网格（12-24 个月）
- **服务治理**：Istio
- **分布式追踪**：Jaeger
- **配置中心**：Consul
- **API 网关**：Kong

---

### 3.3 风险应对

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| DDD 学习曲线 | 中 | 团队培训、代码审查、参考优秀案例 |
| 过度设计 | 中 | 从简单开始，按需重构 |
| 性能瓶颈 | 高 | 性能测试、缓存优化、数据库优化 |
| 分布式事务复杂 | 高 | MVP 使用本地事务，后期引入 Saga |

---

## 4. 详细设计

### 4.1 领域模型设计

#### 4.1.1 用户领域

**聚合根**：User

```typescript
// 领域层
class User {
  private id: UserId;
  private email: Email;  // 值对象
  private password: HashedPassword;  // 值对象
  private profile: UserProfile;  // 实体

  // 工厂方法
  static create(email: string, password: string): User {
    return new User(
      UserId.generate(),
      new Email(email),
      HashedPassword.fromPlainText(password),
      UserProfile.default()
    );
  }

  // 领域行为
  changePassword(oldPassword: string, newPassword: string): void {
    if (!this.password.verify(oldPassword)) {
      throw new InvalidPasswordError();
    }
    this.password = HashedPassword.fromPlainText(newPassword);
  }

  updateProfile(name: string, avatar: string): void {
    this.profile.update(name, avatar);
  }
}

// 值对象
class Email {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new InvalidEmailError();
    }
  }

  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// 仓储接口（领域层定义，基础设施层实现）
interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
```

#### 4.1.2 会议领域

**聚合根**：Meeting

```typescript
class Meeting {
  private id: MeetingId;
  private title: string;
  private hostId: UserId;
  private participants: Participant[];  // 聚合内部实体
  private schedule: MeetingSchedule;  // 值对象
  private status: MeetingStatus;  // 枚举

  // 工厂方法
  static create(
    title: string,
    hostId: UserId,
    schedule: MeetingSchedule
  ): Meeting {
    const meeting = new Meeting();
    meeting.id = MeetingId.generate();
    meeting.title = title;
    meeting.hostId = hostId;
    meeting.schedule = schedule;
    meeting.status = MeetingStatus.Scheduled;
    meeting.participants = [];
    return meeting;
  }

  // 领域行为
  addParticipant(userId: UserId): void {
    if (this.status !== MeetingStatus.InProgress) {
      throw new MeetingNotActiveError();
    }
    if (this.participants.length >= 50) {
      throw new MeetingFullError();
    }
    if (this.hasParticipant(userId)) {
      throw new AlreadyJoinedError();
    }

    this.participants.push(
      new Participant(userId, new Date())
    );
  }

  removeParticipant(userId: UserId): void {
    this.participants = this.participants.filter(
      p => !p.userId.equals(userId)
    );
  }

  start(): void {
    if (this.status !== MeetingStatus.Scheduled) {
      throw new InvalidStatusTransitionError();
    }
    this.status = MeetingStatus.InProgress;
  }

  end(): void {
    if (this.status !== MeetingStatus.InProgress) {
      throw new InvalidStatusTransitionError();
    }
    this.status = MeetingStatus.Ended;
  }
}

// 值对象
class MeetingSchedule {
  constructor(
    private readonly startTime: Date,
    private readonly endTime: Date
  ) {
    if (startTime >= endTime) {
      throw new InvalidScheduleError();
    }
  }

  isConflict(other: MeetingSchedule): boolean {
    return this.startTime < other.endTime &&
           this.endTime > other.startTime;
  }
}

// 领域服务
class MeetingScheduleService {
  constructor(private meetingRepo: MeetingRepository) {}

  async checkConflict(
    userId: UserId,
    schedule: MeetingSchedule
  ): Promise<boolean> {
    const meetings = await this.meetingRepo
      .findByUserIdAndDate(userId, schedule.startTime);

    return meetings.some(m =>
      m.schedule.isConflict(schedule)
    );
  }
}
```

---

### 4.2 应用层设计

#### 4.2.1 用例示例

```typescript
// 应用层
class CreateMeetingUseCase {
  constructor(
    private meetingRepo: MeetingRepository,
    private userRepo: UserRepository,
    private scheduleService: MeetingScheduleService,
    private notificationService: NotificationService
  ) {}

  async execute(command: CreateMeetingCommand): Promise<MeetingDto> {
    // 1. 验证用户存在
    const host = await this.userRepo.findById(command.hostId);
    if (!host) throw new UserNotFoundError();

    // 2. 检查时间冲突
    const schedule = new MeetingSchedule(
      command.startTime,
      command.endTime
    );
    const hasConflict = await this.scheduleService.checkConflict(
      command.hostId,
      schedule
    );
    if (hasConflict) throw new ScheduleConflictError();

    // 3. 创建会议
    const meeting = Meeting.create(
      command.title,
      command.hostId,
      schedule
    );

    // 4. 持久化
    await this.meetingRepo.save(meeting);

    // 5. 发送通知
    await this.notificationService.sendMeetingInvitation(
      meeting,
      command.invitees
    );

    // 6. 返回 DTO
    return MeetingDto.fromDomain(meeting);
  }
}

// DTO
class CreateMeetingCommand {
  hostId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  invitees: string[];
}

class MeetingDto {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  participantCount: number;

  static fromDomain(meeting: Meeting): MeetingDto {
    return {
      id: meeting.id.toString(),
      title: meeting.title,
      startTime: meeting.schedule.startTime,
      endTime: meeting.schedule.endTime,
      participantCount: meeting.participants.length
    };
  }
}
```

---

### 4.3 基础设施层设计

#### 4.3.1 仓储实现

```typescript
// 基础设施层
class MeetingRepositoryImpl implements MeetingRepository {
  constructor(
    private db: DatabaseConnection,
    private mapper: MeetingMapper
  ) {}

  async findById(id: MeetingId): Promise<Meeting | null> {
    const row = await this.db.query(
      'SELECT * FROM meetings WHERE id = $1',
      [id.toString()]
    );

    if (!row) return null;

    return this.mapper.toDomain(row);
  }

  async save(meeting: Meeting): Promise<void> {
    const data = this.mapper.toPersistence(meeting);

    await this.db.query(
      `INSERT INTO meetings (id, title, host_id, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = $2, start_time = $4, end_time = $5, status = $6`,
      [data.id, data.title, data.hostId, data.startTime, data.endTime, data.status]
    );
  }
}

// Mapper（领域模型 ↔ 数据库模型）
class MeetingMapper {
  toDomain(row: any): Meeting {
    // 从数据库行转换为领域对象
  }

  toPersistence(meeting: Meeting): any {
    // 从领域对象转换为数据库行
  }
}
```

---

### 4.4 依赖注入配置

```typescript
// NestJS 模块配置
@Module({
  imports: [TypeOrmModule.forFeature([MeetingEntity])],
  providers: [
    // 应用层
    CreateMeetingUseCase,
    JoinMeetingUseCase,

    // 领域服务
    MeetingScheduleService,

    // 仓储
    {
      provide: 'MeetingRepository',
      useClass: MeetingRepositoryImpl
    },

    // 基础设施
    NotificationService,
  ],
  controllers: [MeetingController],
})
export class MeetingModule {}
```

---

## 5. 质量保障

### 5.1 测试策略

#### 5.1.1 单元测试

**领域层测试**（最重要）：
```typescript
describe('Meeting', () => {
  it('should add participant when meeting is active', () => {
    const meeting = Meeting.create(...);
    meeting.start();

    const userId = UserId.generate();
    meeting.addParticipant(userId);

    expect(meeting.participants).toHaveLength(1);
  });

  it('should throw error when meeting is full', () => {
    const meeting = Meeting.create(...);
    meeting.start();

    // 添加 50 个参会者
    for (let i = 0; i < 50; i++) {
      meeting.addParticipant(UserId.generate());
    }

    expect(() => {
      meeting.addParticipant(UserId.generate());
    }).toThrow(MeetingFullError);
  });
});
```

**应用层测试**：
```typescript
describe('CreateMeetingUseCase', () => {
  it('should create meeting successfully', async () => {
    const mockRepo = { save: jest.fn() };
    const useCase = new CreateMeetingUseCase(mockRepo, ...);

    const result = await useCase.execute({
      hostId: 'user-123',
      title: 'Test Meeting',
      ...
    });

    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.id).toBeDefined();
  });
});
```

#### 5.1.2 集成测试

```typescript
describe('Meeting API', () => {
  it('POST /api/v1/meetings should create meeting', async () => {
    const response = await request(app)
      .post('/api/v1/meetings')
      .send({
        title: 'Test Meeting',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z'
      })
      .expect(201);

    expect(response.body.data.id).toBeDefined();
  });
});
```

---

### 5.2 代码质量指标

| 指标 | 目标 |
|-----|------|
| 单元测试覆盖率 | >80% |
| 集成测试覆盖率 | >60% |
| 圈复杂度 | <10 |
| 函数长度 | <50 行 |

---

## 6. 参考资料

### 6.1 DDD 理论
- [Domain-Driven Design (Eric Evans)](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design (Vaughn Vernon)](https://vaughnvernon.com/)

### 6.2 Clean Architecture
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

### 6.3 开源项目
- [Node.js DDD 示例](https://github.com/stemmlerjs/ddd-forum)
- [Go DDD 示例](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example)

### 6.4 技术博客
- [Martin Fowler - Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)
- [Microsoft - DDD in .NET](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/)

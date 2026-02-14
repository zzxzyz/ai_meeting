# AI Meeting - 后端服务

企业级视频会议系统的后端服务，基于 NestJS + PostgreSQL + Redis。

## 技术栈

- **框架**: NestJS 10.x
- **语言**: TypeScript 5.x
- **数据库**: PostgreSQL 14+
- **缓存**: Redis 7+
- **ORM**: TypeORM
- **认证**: JWT + Passport
- **验证**: class-validator
- **日志**: Winston

## 架构设计

采用 DDD 分层架构：

```
src/
├── api/                    # 用户接口层
│   ├── controllers/        # REST API 控制器
│   ├── websocket/          # WebSocket 网关
│   ├── middleware/         # 中间件
│   └── dto/                # 数据传输对象
│
├── application/            # 应用层
│   ├── use-cases/          # 业务用例
│   ├── dto/                # 应用层 DTO
│   └── services/           # 应用服务
│
├── domain/                 # 领域层
│   ├── user/               # 用户领域
│   ├── meeting/            # 会议领域
│   └── shared/             # 共享领域对象
│
├── infrastructure/         # 基础设施层
│   ├── database/           # 数据库
│   │   ├── entities/       # 数据库实体
│   │   ├── repositories/   # 仓储实现
│   │   └── migrations/     # 数据库迁移
│   ├── cache/              # 缓存
│   └── config/             # 配置
│
└── common/                 # 公共模块
    ├── decorators/         # 装饰器
    ├── filters/            # 异常过滤器
    ├── guards/             # 守卫
    ├── interceptors/       # 拦截器
    └── pipes/              # 管道
```

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 7
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

关键配置：

```env
# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=ai_meeting

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
```

### 创建数据库

```bash
# 连接 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE ai_meeting;

# 退出
\q
```

### 运行数据库迁移

```bash
pnpm migration:run
```

### 启动开发服务器

```bash
pnpm start:dev
```

服务器将在 `http://localhost:3000` 启动。

### 验证服务

```bash
# 健康检查
curl http://localhost:3000/api/v1/health

# 应返回：
# {"status":"ok","timestamp":"...","uptime":...}
```

## 开发

### 创建新模块

使用 NestJS CLI 创建模块：

```bash
nest g module api/controllers/example
nest g controller api/controllers/example
nest g service application/services/example
```

### 数据库迁移

```bash
# 生成迁移文件
pnpm migration:generate src/infrastructure/database/migrations/CreateUserTable

# 运行迁移
pnpm migration:run

# 回滚迁移
pnpm migration:revert
```

### 运行测试

```bash
# 单元测试
pnpm test

# E2E 测试
pnpm test:e2e

# 测试覆盖率
pnpm test:cov
```

### 代码检查

```bash
# ESLint
pnpm lint

# Prettier
pnpm format

# TypeScript 类型检查
pnpm build
```

## 项目结构说明

### API 层 (src/api)

负责接收和响应 HTTP 请求、WebSocket 连接。

- **Controllers**: RESTful API 端点
- **WebSocket**: 实时通信网关
- **Middleware**: 认证、日志、限流等
- **DTO**: 请求/响应数据传输对象

### 应用层 (src/application)

编排业务流程，协调领域对象。

- **Use Cases**: 业务用例（如"创建会议"、"加入会议"）
- **Services**: 应用服务
- **DTO**: 应用层数据传输对象

### 领域层 (src/domain)

核心业务逻辑，独立于技术实现。

- **Entities**: 领域实体（如 User、Meeting）
- **Value Objects**: 值对象（如 Email、MeetingNumber）
- **Repositories**: 仓储接口（在基础设施层实现）
- **Domain Services**: 领域服务

### 基础设施层 (src/infrastructure)

技术实现细节。

- **Database**: TypeORM 实体、仓储实现、迁移
- **Cache**: Redis 缓存服务
- **Config**: 配置管理

### 公共模块 (src/common)

跨层共享的工具和组件。

- **Decorators**: 自定义装饰器
- **Filters**: 全局异常过滤器
- **Guards**: 认证守卫、权限守卫
- **Interceptors**: 日志、转换等拦截器
- **Pipes**: 验证管道

## API 文档

### RESTful API

API 遵循 OpenAPI 3.0 规范，详见 `docs/api-contract-draft.md`。

**Base URL**: `http://localhost:3000/api/v1`

**认证方式**: Bearer Token

```
Authorization: Bearer {access_token}
```

**统一响应格式**:

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

### WebSocket API

**URL**: `ws://localhost:3000/api/v1/ws?access_token={token}`

**消息格式**:

```json
{
  "type": "message_type",
  "seq": 123,
  "timestamp": 1707894000000,
  "data": {}
}
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | development |
| `PORT` | 服务端口 | 3000 |
| `API_PREFIX` | API 前缀 | api/v1 |
| `DATABASE_HOST` | 数据库主机 | localhost |
| `DATABASE_PORT` | 数据库端口 | 5432 |
| `DATABASE_USERNAME` | 数据库用户名 | postgres |
| `DATABASE_PASSWORD` | 数据库密码 | postgres |
| `DATABASE_NAME` | 数据库名称 | ai_meeting |
| `REDIS_HOST` | Redis 主机 | localhost |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `JWT_SECRET` | JWT 密钥 | - |
| `JWT_EXPIRES_IN` | JWT 过期时间 | 1h |

## Docker 支持

### 使用 Docker Compose

```bash
# 启动所有服务（PostgreSQL + Redis + Backend）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

### 构建镜像

```bash
# 构建
docker build -t ai-meeting-backend .

# 运行
docker run -p 3000:3000 --env-file .env ai-meeting-backend
```

## 部署

### 生产构建

```bash
# 构建
pnpm build

# 运行生产服务器
pnpm start:prod
```

### 性能优化

- 启用 Redis 缓存
- 配置 PostgreSQL 连接池
- 启用 Gzip 压缩
- 使用 PM2 进程管理

## 监控

### 健康检查

```bash
GET /api/v1/health
```

### 日志

日志文件位于 `logs/` 目录：

- `combined.log`: 所有日志
- `error.log`: 错误日志

### 性能监控

- TODO: 集成 Prometheus
- TODO: 集成 Grafana

## 故障排查

### 数据库连接失败

1. 检查 PostgreSQL 是否运行：`psql -U postgres -c "SELECT version();"`
2. 检查数据库是否存在：`psql -U postgres -l`
3. 检查配置：`.env` 中的数据库配置是否正确

### Redis 连接失败

1. 检查 Redis 是否运行：`redis-cli ping`
2. 检查配置：`.env` 中的 Redis 配置是否正确

### 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 终止进程
kill -9 <PID>
```

## 相关文档

- [API 契约文档](../../docs/api-contract-draft.md)
- [后端架构设计](../../docs/architecture/backend.md)
- [系统架构设计](../../docs/architecture/system.md)
- [项目规划](../../docs/versions/v0.1/plan.md)

## License

Private - 企业内部项目

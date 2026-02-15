# REQ-001 用户认证服务实现

## 实现概述

本模块实现了完整的用户认证服务,包括:

✅ **1. DTO 类**
- `auth.dto.ts` - 注册、登录、Token 响应 DTO
- `user.dto.ts` - 用户信息、更新用户 DTO

✅ **2. 实体 (Entities)**
- `user.entity.ts` - 用户实体 (已存在)
- `refresh-token.entity.ts` - Refresh Token 实体 (新增)

✅ **3. 仓储 (Repositories)**
- `user.repository.ts` - 用户数据访问层
- `refresh-token.repository.ts` - Refresh Token 数据访问层

✅ **4. 服务 (Services)**
- `auth.service.ts` - 认证业务逻辑 (注册、登录、刷新、登出)
- `user.service.ts` - 用户信息管理

✅ **5. 控制器 (Controllers)**
- `auth.controller.ts` - 认证接口 (注册、登录、刷新、登出)
- `user.controller.ts` - 用户接口 (获取/更新当前用户信息)

✅ **6. 安全组件**
- `jwt.strategy.ts` - JWT 认证策略
- `jwt-auth.guard.ts` - JWT 认证守卫

✅ **7. 单元测试**
- `auth.service.spec.ts` - AuthService 单元测试
- `user.service.spec.ts` - UserService 单元测试
- `auth.controller.spec.ts` - AuthController 单元测试

---

## 功能特性

### 1. JWT 双令牌机制
- **Access Token**: 1小时有效期,存储在内存
- **Refresh Token**: 7天有效期,存储在 HttpOnly Cookie
- **Token 刷新**: 自动刷新机制,用户无感知
- **防重放攻击**: Refresh Token 一次性使用

### 2. 密码安全
- **算法**: bcrypt
- **Cost Factor**: 12
- **自动加盐**: bcrypt 内置

### 3. 安全措施
- **HttpOnly Cookie**: 防止 XSS 攻击
- **SameSite Cookie**: 防止 CSRF 攻击
- **Token 哈希存储**: 数据库存储 Token 哈希而非明文
- **异常检测**: 检测重放攻击并撤销所有 Token

---

## 环境配置

在 `.env` 文件中添加以下配置:

\`\`\`env
# JWT 配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h

# Refresh Token 配置
REFRESH_TOKEN_EXPIRES_IN=604800  # 7 天 (秒)

# Bcrypt 配置
BCRYPT_ROUNDS=12

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ai_meeting
\`\`\`

---

## 数据库迁移

### 1. 创建迁移文件

\`\`\`bash
cd apps/backend
npm run migration:generate -- src/infrastructure/database/migrations/CreateRefreshToken
\`\`\`

### 2. 运行迁移

\`\`\`bash
npm run migration:run
\`\`\`

### 3. 回滚迁移

\`\`\`bash
npm run migration:revert
\`\`\`

---

## 运行应用

### 1. 安装依赖

\`\`\`bash
cd apps/backend
pnpm install
\`\`\`

### 2. 启动数据库

\`\`\`bash
docker-compose up -d postgres redis
\`\`\`

### 3. 运行迁移

\`\`\`bash
npm run migration:run
\`\`\`

### 4. 启动应用

\`\`\`bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
\`\`\`

应用将运行在 `http://localhost:3000`

---

## 测试

### 1. 运行所有测试

\`\`\`bash
cd apps/backend
npm test
\`\`\`

### 2. 运行单元测试

\`\`\`bash
npm run test:watch
\`\`\`

### 3. 测试覆盖率

\`\`\`bash
npm run test:cov
\`\`\`

**目标覆盖率**: > 90%

### 4. 测试结果

当前测试覆盖:
- ✅ AuthService: 注册、登录、刷新、登出
- ✅ UserService: 获取用户、更新用户
- ✅ AuthController: 所有接口
- ✅ 边界情况: 错误处理、异常场景

---

## API 测试

### 1. 用户注册

\`\`\`bash
curl -X POST http://localhost:3000/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "nickname": "测试用户"
  }'
\`\`\`

### 2. 用户登录

\`\`\`bash
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
\`\`\`

### 3. 获取当前用户信息

\`\`\`bash
curl -X GET http://localhost:3000/users/me \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

### 4. 刷新 Token

\`\`\`bash
curl -X POST http://localhost:3000/auth/refresh \\
  -H "Cookie: refresh_token=<refresh_token>"
\`\`\`

### 5. 登出

\`\`\`bash
curl -X POST http://localhost:3000/auth/logout \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Cookie: refresh_token=<refresh_token>"
\`\`\`

---

## 文件结构

\`\`\`
apps/backend/src/
├── api/
│   ├── dto/
│   │   ├── auth.dto.ts              # 认证 DTO
│   │   └── user.dto.ts              # 用户 DTO
│   └── controllers/
│       ├── auth/
│       │   ├── auth.controller.ts   # 认证控制器
│       │   └── auth.module.ts       # 认证模块
│       └── user/
│           ├── user.controller.ts   # 用户控制器
│           └── user.module.ts       # 用户模块
├── application/
│   └── services/
│       ├── auth.service.ts          # 认证服务
│       └── user.service.ts          # 用户服务
├── domain/
│   └── (领域模型)
├── infrastructure/
│   └── database/
│       ├── entities/
│       │   ├── user.entity.ts       # 用户实体
│       │   └── refresh-token.entity.ts  # Refresh Token 实体
│       └── repositories/
│           ├── user.repository.ts   # 用户仓储
│           └── refresh-token.repository.ts  # Refresh Token 仓储
└── common/
    ├── guards/
    │   └── jwt-auth.guard.ts        # JWT 守卫
    └── strategies/
        └── jwt.strategy.ts          # JWT 策略

tests/unit/backend/auth/
├── auth.service.spec.ts             # AuthService 测试
├── user.service.spec.ts             # UserService 测试
└── auth.controller.spec.ts          # AuthController 测试
\`\`\`

---

## 下一步工作

### 1. 限流功能
- [ ] 安装 `@nestjs/throttler`
- [ ] 配置限流策略
- [ ] 添加限流守卫

### 2. 集成测试
- [ ] 编写 E2E 测试
- [ ] 测试完整认证流程
- [ ] 测试并发场景

### 3. 监控和日志
- [ ] 集成 Winston 日志
- [ ] 添加安全日志
- [ ] 添加性能监控

### 4. 优化
- [ ] 添加 Redis 缓存
- [ ] 实现 Token 黑名单
- [ ] 性能优化

---

## 技术栈

- **框架**: NestJS 10.x
- **数据库**: PostgreSQL 14+
- **ORM**: TypeORM 0.3.x
- **认证**: JWT + Passport
- **加密**: bcrypt
- **测试**: Jest
- **文档**: Swagger/OpenAPI

---

## 参考文档

- [API 契约文档](../../../docs/versions/v0.1/requirements/REQ-001/api_contract.md)
- [技术调研报告](../../../docs/versions/v0.1/requirements/REQ-001/tech_research.md)
- [安全架构文档](../../../docs/architecture/security.md)
- [ADR-007: JWT 双令牌认证](../../../docs/architecture/adr.md)

---

**实现日期**: 2026-02-15
**负责人**: architect
**状态**: 已完成 ✅

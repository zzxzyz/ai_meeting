# REQ-001: 用户认证系统 - 需求分析

## 文档信息

- **需求编号**: REQ-001
- **需求名称**: 用户认证系统
- **优先级**: P0
- **负责 Team**: 后端 + 前端 + 客户端
- **依赖需求**: 无
- **创建日期**: 2026-02-15
- **更新日期**: 2026-02-15
- **分析人员**: Product Manager

## 1. 需求概述

### 1.1 业务目标

实现完整的用户认证体系,为视频会议平台提供安全可靠的用户身份认证、授权和会话管理功能。该系统是所有其他功能模块的基础设施,必须保证高安全性、高可用性。

### 1.2 用户价值

- **新用户**: 可快速注册账号,无需复杂的验证流程
- **已注册用户**: 可安全登录,保持登录状态,避免频繁输入密码
- **系统管理员**: 获得完整的用户身份管理能力,防止非法访问
- **开发团队**: 获得标准化的认证授权机制,统一 API 安全策略

## 2. 功能边界

### 2.1 功能范围 (In Scope)

#### 2.1.1 用户注册
- 邮箱 + 密码 + 昵称注册
- 邮箱格式校验
- 密码强度校验(至少 8 位,包含字母和数字)
- 昵称长度限制(2-20 个字符)
- 邮箱唯一性验证
- 注册成功后自动登录

#### 2.1.2 用户登录
- 邮箱 + 密码登录
- JWT Token 生成(Access Token + Refresh Token)
- Token 返回给客户端
- 登录失败次数限制(防止暴力破解)

#### 2.1.3 Token 管理
- Access Token 有效期: 1 小时
- Refresh Token 有效期: 7 天
- Token 自动刷新机制
- Token 签名验证
- Token 解析和用户信息提取

#### 2.1.4 用户登出
- Token 加入黑名单(实现失效)
- 清除客户端存储的 Token
- 登出后需重新登录

#### 2.1.5 用户信息查询
- 查询当前登录用户的基本信息
- 支持通过 Token 获取用户身份

### 2.2 功能排除 (Out of Scope)

以下功能不在 v0.1 MVP 范围内:

- ❌ 第三方登录(Google/GitHub/微信等)
- ❌ 短信验证码注册/登录
- ❌ 邮箱验证(邮件激活)
- ❌ 忘记密码/重置密码
- ❌ 手机号注册/登录
- ❌ 双因素认证(2FA)
- ❌ 单点登录(SSO)
- ❌ OAuth 2.0 授权服务
- ❌ 用户资料修改(头像、个人简介等)
- ❌ 账号注销
- ❌ 登录设备管理

## 3. 用户场景分析

### 3.1 用户注册场景

**前置条件**: 用户未注册账号

**主流程**:
1. 用户打开注册页面
2. 用户输入邮箱、密码、昵称
3. 用户点击"注册"按钮
4. 系统验证输入合法性(前端 + 后端双重验证)
5. 系统检查邮箱是否已注册
6. 系统对密码进行 bcrypt 加密存储
7. 系统创建用户记录
8. 系统生成 JWT Token(Access + Refresh)
9. 系统返回 Token 给客户端
10. 客户端保存 Token 到本地存储
11. 客户端跳转到主页面

**异常流程**:
- **邮箱格式错误**: 前端提示"请输入有效的邮箱地址"
- **密码强度不足**: 前端提示"密码至少 8 位,包含字母和数字"
- **昵称长度不符**: 前端提示"昵称长度为 2-20 个字符"
- **邮箱已注册**: 后端返回 409 Conflict,前端提示"该邮箱已被注册,请直接登录"
- **网络错误**: 前端提示"注册失败,请检查网络连接"
- **服务端异常**: 后端返回 500,前端提示"注册失败,请稍后重试"

### 3.2 用户登录场景

**前置条件**: 用户已注册账号且未登录

**主流程**:
1. 用户打开登录页面
2. 用户输入邮箱、密码
3. 用户点击"登录"按钮
4. 系统验证邮箱格式(前端)
5. 系统查询用户记录
6. 系统验证密码(bcrypt.compare)
7. 系统生成 JWT Token(Access + Refresh)
8. 系统返回 Token 给客户端
9. 客户端保存 Token 到本地存储
10. 客户端跳转到主页面

**异常流程**:
- **邮箱格式错误**: 前端提示"请输入有效的邮箱地址"
- **用户不存在**: 后端返回 401,前端提示"邮箱或密码错误"
- **密码错误**: 后端返回 401,前端提示"邮箱或密码错误"
- **登录失败次数超限**: 后端返回 429,前端提示"登录失败次数过多,请 10 分钟后重试"
- **网络错误**: 前端提示"登录失败,请检查网络连接"

### 3.3 Token 自动刷新场景

**前置条件**: 用户已登录,Access Token 即将过期或已过期

**主流程**:
1. 客户端发起 API 请求
2. 客户端检测 Access Token 将在 5 分钟内过期
3. 客户端使用 Refresh Token 请求刷新接口
4. 后端验证 Refresh Token 有效性
5. 后端检查 Refresh Token 是否在黑名单中
6. 后端生成新的 Access Token
7. 后端返回新的 Access Token
8. 客户端更新本地存储的 Access Token
9. 客户端使用新 Token 重试原 API 请求

**异常流程**:
- **Refresh Token 过期**: 客户端清除 Token,跳转到登录页
- **Refresh Token 在黑名单**: 客户端清除 Token,跳转到登录页
- **Refresh Token 无效**: 客户端清除 Token,跳转到登录页

### 3.4 用户登出场景

**前置条件**: 用户已登录

**主流程**:
1. 用户点击"退出登录"按钮
2. 客户端发送登出请求(携带 Refresh Token)
3. 后端将 Refresh Token 加入黑名单
4. 后端返回成功响应
5. 客户端清除本地存储的所有 Token
6. 客户端跳转到登录页面

**异常流程**:
- **网络错误**: 客户端强制清除本地 Token,跳转到登录页
- **Token 已失效**: 客户端清除本地 Token,跳转到登录页

### 3.5 用户信息查询场景

**前置条件**: 用户已登录

**主流程**:
1. 客户端发送获取用户信息请求(携带 Access Token)
2. 后端验证 Access Token 有效性
3. 后端从 Token 中解析 userId
4. 后端查询用户信息
5. 后端返回用户基本信息(userId, email, nickname, createdAt)

**异常流程**:
- **Token 无效**: 后端返回 401,客户端跳转到登录页
- **Token 过期**: 客户端自动刷新 Token 后重试
- **用户不存在**: 后端返回 404(理论上不会发生)

## 4. 输入输出定义

### 4.1 用户注册 API

**接口**: `POST /api/v1/auth/register`

**输入**:
```json
{
  "email": "user@example.com",      // 必填,邮箱格式
  "password": "Password123",         // 必填,至少 8 位,包含字母和数字
  "nickname": "张三"                 // 必填,2-20 字符
}
```

**输出 - 成功(201 Created)**:
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "user": {
      "userId": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三",
      "createdAt": "2026-02-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600  // Access Token 过期时间(秒)
    }
  }
}
```

**输出 - 失败**:
- **400 Bad Request** - 输入验证失败
  ```json
  {
    "code": 40001,
    "message": "邮箱格式错误",
    "data": null
  }
  ```
- **409 Conflict** - 邮箱已注册
  ```json
  {
    "code": 40901,
    "message": "该邮箱已被注册",
    "data": null
  }
  ```
- **429 Too Many Requests** - 注册请求过于频繁
  ```json
  {
    "code": 42901,
    "message": "注册请求过于频繁,请稍后重试",
    "data": null
  }
  ```

### 4.2 用户登录 API

**接口**: `POST /api/v1/auth/login`

**输入**:
```json
{
  "email": "user@example.com",      // 必填,邮箱格式
  "password": "Password123"          // 必填
}
```

**输出 - 成功(200 OK)**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user": {
      "userId": "uuid-string",
      "email": "user@example.com",
      "nickname": "张三",
      "createdAt": "2026-02-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

**输出 - 失败**:
- **401 Unauthorized** - 认证失败
  ```json
  {
    "code": 40101,
    "message": "邮箱或密码错误",
    "data": null
  }
  ```
- **429 Too Many Requests** - 登录失败次数超限
  ```json
  {
    "code": 42902,
    "message": "登录失败次数过多,请 10 分钟后重试",
    "data": {
      "retryAfter": 600  // 秒
    }
  }
  ```

### 4.3 Token 刷新 API

**接口**: `POST /api/v1/auth/refresh`

**输入**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // 必填
}
```

**输出 - 成功(200 OK)**:
```json
{
  "code": 0,
  "message": "Token 刷新成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**输出 - 失败**:
- **401 Unauthorized** - Refresh Token 无效或过期
  ```json
  {
    "code": 40102,
    "message": "Token 已失效,请重新登录",
    "data": null
  }
  ```

### 4.4 用户登出 API

**接口**: `POST /api/v1/auth/logout`

**请求头**:
```
Authorization: Bearer <accessToken>
```

**输入**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // 必填
}
```

**输出 - 成功(200 OK)**:
```json
{
  "code": 0,
  "message": "退出登录成功",
  "data": null
}
```

### 4.5 用户信息查询 API

**接口**: `GET /api/v1/auth/me`

**请求头**:
```
Authorization: Bearer <accessToken>
```

**输出 - 成功(200 OK)**:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "userId": "uuid-string",
    "email": "user@example.com",
    "nickname": "张三",
    "createdAt": "2026-02-15T10:30:00Z"
  }
}
```

**输出 - 失败**:
- **401 Unauthorized** - Token 无效或过期
  ```json
  {
    "code": 40103,
    "message": "未授权访问,请先登录",
    "data": null
  }
  ```

## 5. 业务规则

### 5.1 邮箱验证规则
- 必须符合标准邮箱格式(RFC 5322)
- 支持的域名不限制(允许企业邮箱、个人邮箱)
- 邮箱不区分大小写(统一转小写存储)
- 邮箱必须唯一

### 5.2 密码验证规则
- 最小长度: 8 个字符
- 最大长度: 64 个字符
- 必须包含字母(a-z 或 A-Z)
- 必须包含数字(0-9)
- 不强制要求特殊字符(简化 MVP 体验)
- 密码使用 bcrypt 加密存储(cost factor = 10)

### 5.3 昵称验证规则
- 最小长度: 2 个字符
- 最大长度: 20 个字符
- 支持中文、英文、数字、下划线
- 不检查唯一性(允许重名)
- 不允许纯空格
- 自动去除首尾空格

### 5.4 JWT Token 规则

#### Access Token
- 有效期: 1 小时
- 签名算法: HS256
- Payload 包含:
  ```json
  {
    "userId": "uuid-string",
    "email": "user@example.com",
    "type": "access",
    "iat": 1739582400,  // 签发时间
    "exp": 1739586000   // 过期时间
  }
  ```

#### Refresh Token
- 有效期: 7 天
- 签名算法: HS256
- Payload 包含:
  ```json
  {
    "userId": "uuid-string",
    "tokenId": "uuid-string",  // 用于黑名单追踪
    "type": "refresh",
    "iat": 1739582400,
    "exp": 1740187200
  }
  ```

### 5.5 Token 刷新规则
- 客户端应在 Access Token 过期前 5 分钟主动刷新
- 如果 Access Token 已过期,API 返回 401,触发刷新流程
- 刷新成功后,原 API 请求应自动重试
- Refresh Token 本身不会被刷新(固定 7 天有效期)
- 用户登出后,Refresh Token 立即失效

### 5.6 Token 黑名单规则
- 使用 Redis 存储黑名单
- Key 格式: `token:blacklist:{tokenId}`
- TTL: 与 Refresh Token 的剩余有效期一致
- 登出时将 Refresh Token 的 tokenId 加入黑名单
- Token 刷新和 API 请求时检查黑名单

### 5.7 限流规则

#### 注册接口
- 单 IP 限制: 5 次/小时
- 单邮箱限制: 3 次/小时(防止恶意注册)

#### 登录接口
- 单 IP 限制: 10 次/分钟
- 单邮箱限制: 5 次/分钟
- 登录失败累计 5 次后,锁定 10 分钟

#### Token 刷新接口
- 单用户限制: 20 次/分钟

#### 用户信息查询接口
- 单用户限制: 100 次/分钟

## 6. 数据模型设计

### 6.1 用户表 (users)

**表名**: `users`

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 用户 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 邮箱(小写) |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 加密后的密码 |
| nickname | VARCHAR(50) | NOT NULL | 昵称 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新时间 |

**索引**:
- PRIMARY KEY: `id`
- UNIQUE INDEX: `idx_users_email` on `email`
- INDEX: `idx_users_created_at` on `created_at`

**示例数据**:
```sql
INSERT INTO users (id, email, password_hash, nickname, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'user@example.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '张三',
  '2026-02-15 10:30:00',
  '2026-02-15 10:30:00'
);
```

### 6.2 Token 黑名单 (Redis)

**数据结构**: String

**Key 格式**: `token:blacklist:{tokenId}`

**Value**: `1` (简单标记)

**TTL**: Refresh Token 的剩余有效期(秒)

**示例**:
```redis
SET token:blacklist:550e8400-e29b-41d4-a716-446655440001 1 EX 604800
```

### 6.3 登录失败计数器 (Redis)

**数据结构**: String

**Key 格式**: `login:failed:{email}`

**Value**: 失败次数(整数)

**TTL**: 600 秒(10 分钟)

**示例**:
```redis
SET login:failed:user@example.com 3 EX 600
INCR login:failed:user@example.com
```

### 6.4 限流计数器 (Redis)

**数据结构**: String

**Key 格式**:
- 注册: `ratelimit:register:ip:{ip}`, `ratelimit:register:email:{email}`
- 登录: `ratelimit:login:ip:{ip}`, `ratelimit:login:email:{email}`
- 刷新: `ratelimit:refresh:user:{userId}`

**Value**: 请求次数(整数)

**TTL**: 根据限流窗口设置(60 秒或 3600 秒)

## 7. 异常处理

### 7.1 客户端异常处理

#### 网络异常
- **现象**: 请求超时、无响应
- **处理**: 显示"网络连接失败,请检查网络"提示,提供重试按钮

#### Token 过期
- **现象**: API 返回 401 且错误码表明 Token 过期
- **处理**: 自动使用 Refresh Token 刷新,刷新成功后重试原请求

#### Refresh Token 失效
- **现象**: Token 刷新接口返回 401
- **处理**: 清除本地 Token,跳转到登录页,提示"登录已过期,请重新登录"

#### 输入验证失败
- **现象**: 前端表单验证失败
- **处理**: 在对应输入框下方显示红色错误提示,禁用提交按钮

### 7.2 服务端异常处理

#### 数据库连接失败
- **返回**: 500 Internal Server Error
- **日志**: ERROR 级别,记录详细错误堆栈
- **监控**: 触发告警,通知运维团队

#### Redis 连接失败
- **处理**: 限流功能降级(暂时不限流),黑名单检查降级(不检查)
- **日志**: WARN 级别,记录 Redis 不可用
- **监控**: 触发告警

#### 密码加密失败
- **返回**: 500 Internal Server Error
- **日志**: ERROR 级别
- **监控**: 触发告警

#### JWT 签名失败
- **返回**: 500 Internal Server Error
- **日志**: ERROR 级别
- **监控**: 触发告警

### 7.3 边界情况处理

#### 并发注册同一邮箱
- **处理**: 数据库 UNIQUE 约束保证只有一个成功,其他返回 409 Conflict

#### 并发登录同一账号
- **处理**: 允许多端登录,每次登录生成独立的 Token

#### Token 即将过期时刷新
- **处理**: 允许在过期前后 5 分钟内刷新(服务端时钟允许 5 分钟误差)

#### 用户在登录页面时 Token 过期
- **处理**: 无影响,用户重新登录即可

## 8. 安全要求

### 8.1 密码安全

#### 密码加密
- 使用 bcrypt 算法(cost factor = 10)
- 每个密码有独立的 salt
- 密码明文不记录日志,不传输到前端

#### 密码强度
- 前端实时提示密码强度(弱/中/强)
- 后端强制验证密码最小强度要求
- 建议用户使用密码管理器生成强密码

### 8.2 Token 安全

#### 存储安全
- 前端使用 localStorage 存储(考虑 XSS 防护)
- 不在 URL 参数中传递 Token
- 不在 Cookie 中存储(避免 CSRF 攻击)

#### 传输安全
- 所有 API 必须使用 HTTPS
- Token 在请求头 Authorization 中传输
- Token 不记录到访问日志(脱敏处理)

#### Token 有效期
- Access Token: 1 小时(平衡安全性和用户体验)
- Refresh Token: 7 天(长时间保持登录)
- 用户登出后立即失效

### 8.3 API 安全

#### 限流防护
- 注册接口: 5 次/小时/IP
- 登录接口: 10 次/分钟/IP
- 防止暴力破解和 DDoS 攻击

#### 登录失败锁定
- 单邮箱连续失败 5 次后锁定 10 分钟
- 防止暴力破解密码

#### 输入验证
- 前端 + 后端双重验证
- 防止 SQL 注入、XSS 攻击
- 邮箱、昵称长度限制防止 Buffer Overflow

#### CORS 配置
- 仅允许白名单域名访问
- 生产环境限制 Origin

### 8.4 日志安全

#### 敏感信息脱敏
- 密码明文不记录日志
- Token 记录时脱敏(仅保留前 8 位)
- 邮箱部分脱敏(u***@example.com)

#### 安全审计日志
- 记录所有认证相关操作(注册、登录、登出、刷新)
- 记录 IP 地址、User-Agent、时间戳
- 记录失败原因(用于安全分析)

## 9. 性能要求

### 9.1 响应时间

- **注册接口**: P95 < 300ms(包含密码加密时间)
- **登录接口**: P95 < 300ms(包含密码验证时间)
- **Token 刷新**: P95 < 100ms
- **登出接口**: P95 < 100ms
- **用户信息查询**: P95 < 50ms

### 9.2 并发能力

- **注册接口**: 支持 100 QPS
- **登录接口**: 支持 500 QPS
- **Token 刷新**: 支持 1000 QPS
- **用户信息查询**: 支持 2000 QPS

### 9.3 数据库性能

- **用户表查询**: < 10ms(通过邮箱索引)
- **用户表插入**: < 50ms
- **数据库连接池**: 最小 10,最大 50

### 9.4 Redis 性能

- **黑名单查询**: < 5ms
- **限流计数**: < 5ms
- **连接池**: 最小 5,最大 20

## 10. 兼容性要求

### 10.1 前端兼容性

#### Web 端浏览器
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

#### Electron 桌面端
- Windows 10+
- macOS 11+

### 10.2 API 兼容性

- RESTful API 遵循 OpenAPI 3.0 规范
- Content-Type: application/json
- 响应格式统一(code/message/data)

### 10.3 数据库兼容性

- PostgreSQL 13+
- 支持 UUID 扩展
- 支持 TIMESTAMP WITH TIME ZONE

## 11. 测试要求

### 11.1 单元测试

**覆盖率要求**: > 90%

**测试重点**:
- 邮箱格式验证逻辑
- 密码强度验证逻辑
- 密码加密和验证(bcrypt)
- JWT Token 生成和验证
- Token 刷新逻辑
- 黑名单检查逻辑
- 限流逻辑

### 11.2 集成测试

**覆盖率要求**: > 90%

**测试重点**:
- 注册 API 端到端流程
- 登录 API 端到端流程
- Token 刷新 API 流程
- 登出 API 流程
- 用户信息查询 API 流程
- 数据库事务完整性
- Redis 缓存一致性

### 11.3 安全测试

**测试项**:
- SQL 注入测试
- XSS 攻击测试
- CSRF 攻击测试
- 暴力破解测试
- 限流功能测试
- Token 伪造测试
- Token 重放攻击测试

### 11.4 性能测试

**测试项**:
- 注册接口压测(100 QPS)
- 登录接口压测(500 QPS)
- Token 刷新压测(1000 QPS)
- 数据库连接池测试
- Redis 性能测试

### 11.5 端到端测试

**测试场景**:
- 新用户注册 → 自动登录 → 查看信息 → 登出
- 已注册用户登录 → 查看信息 → Token 刷新 → 登出
- 多端登录(Web + Electron)
- 并发登录测试
- Token 过期自动刷新

## 12. 验收标准

### 12.1 功能验收

- [x] 用户可成功注册并收到成功提示
- [x] 注册后自动登录
- [x] 登录后获得有效 Token
- [x] Token 过期前自动刷新
- [x] 登出后 Token 失效
- [x] 密码采用 bcrypt 加密存储
- [x] API 限流防止暴力破解
- [x] 单元测试覆盖率 > 90%

### 12.2 安全验收

- [x] 密码使用 bcrypt 加密(cost factor = 10)
- [x] JWT Token 使用 HS256 签名
- [x] API 请求必须 HTTPS
- [x] 登录失败 5 次后锁定 10 分钟
- [x] Token 黑名单机制正常工作
- [x] 限流规则正确生效
- [x] 安全审计日志完整

### 12.3 性能验收

- [x] 注册接口 P95 < 300ms
- [x] 登录接口 P95 < 300ms
- [x] Token 刷新 P95 < 100ms
- [x] 注册接口支持 100 QPS
- [x] 登录接口支持 500 QPS

### 12.4 兼容性验收

- [x] Web 端 Chrome/Safari/Firefox/Edge 正常工作
- [x] Electron 桌面端正常工作
- [x] 跨平台 Token 可互通使用

## 13. 交付物

### 13.1 开发阶段

- **后端**:
  - RESTful API 实现(NestJS)
  - 数据库迁移脚本(TypeORM)
  - JWT 中间件
  - 限流中间件
  - 单元测试 + 集成测试

- **前端**:
  - 注册页面组件
  - 登录页面组件
  - Token 管理模块(自动刷新)
  - API 请求拦截器
  - 单元测试

- **客户端**:
  - Electron 注册/登录页面
  - Token 本地存储(electron-store)
  - API 集成

### 13.2 测试阶段

- 测试用例文档(`test_cases.md`)
- 测试报告(`test_report.md`)
- 安全测试报告
- 性能测试报告

### 13.3 文档阶段

- API 契约文档(`api_contract.md`)
- 技术研究文档(`tech_research.md`)
- 评审文档(`review.md`)

## 14. 风险评估

### 14.1 技术风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| bcrypt 加密性能 | 中 | 注册/登录延迟增加 | 使用 cost factor = 10 平衡安全性和性能 |
| Redis 不可用 | 高 | 限流和黑名单功能失效 | 实现降级策略,监控 Redis 可用性 |
| JWT Secret 泄露 | 高 | 所有 Token 可被伪造 | 使用环境变量存储,定期轮换 Secret |
| 数据库连接池耗尽 | 中 | API 响应超时 | 合理配置连接池大小,监控连接数 |

### 14.2 业务风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| 恶意注册 | 中 | 垃圾用户数据 | 限流 + 未来增加邮箱验证 |
| 暴力破解 | 高 | 用户账号被盗 | 登录失败锁定 + 限流 |
| Token 泄露 | 高 | 账号被盗用 | 短有效期 + 黑名单机制 |

### 14.3 进度风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| 安全测试耗时 | 中 | 延期 1-2 天 | 提前准备测试用例,并行测试 |
| 跨端联调时间 | 中 | 延期 1-2 天 | 提前定义 API 契约,Mock 数据开发 |

## 15. 依赖和约束

### 15.1 技术依赖

- **后端框架**: NestJS
- **数据库**: PostgreSQL 13+
- **缓存**: Redis 6+
- **JWT 库**: jsonwebtoken
- **密码加密**: bcrypt
- **ORM**: TypeORM

### 15.2 基础设施依赖

- **HTTPS 证书**: 必须配置 SSL 证书
- **域名**: 需要配置正式域名
- **环境变量**: JWT_SECRET, DATABASE_URL, REDIS_URL

### 15.3 约束条件

- MVP 阶段不支持邮箱验证(简化流程)
- MVP 阶段不支持忘记密码功能
- MVP 阶段不支持第三方登录
- Token 刷新不支持 Sliding Window(固定 7 天)

## 16. 后续版本规划

### v0.2 计划功能

- 邮箱验证(注册时发送激活邮件)
- 忘记密码/重置密码
- 第三方登录(Google/GitHub)
- 用户资料修改(头像上传、昵称修改)
- 登录设备管理(查看/踢出其他设备)

### v0.3 计划功能

- 双因素认证(2FA)
- 手机号注册/登录
- 单点登录(SSO)
- OAuth 2.0 授权服务
- 账号注销

## 17. 附录

### 17.1 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| 0 | 200/201 | 成功 |
| 40001 | 400 | 邮箱格式错误 |
| 40002 | 400 | 密码强度不足 |
| 40003 | 400 | 昵称长度不符 |
| 40004 | 400 | 缺少必填字段 |
| 40101 | 401 | 邮箱或密码错误 |
| 40102 | 401 | Token 已失效 |
| 40103 | 401 | 未授权访问 |
| 40901 | 409 | 邮箱已被注册 |
| 42901 | 429 | 注册请求过于频繁 |
| 42902 | 429 | 登录失败次数过多 |
| 50000 | 500 | 服务器内部错误 |

### 17.2 参考文档

- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [bcrypt 算法](https://en.wikipedia.org/wiki/Bcrypt)
- [OWASP 认证最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 5322 - 邮箱格式](https://tools.ietf.org/html/rfc5322)

### 17.3 术语表

- **JWT**: JSON Web Token,一种开放标准(RFC 7519)
- **bcrypt**: 密码哈希函数,基于 Blowfish 加密算法
- **Access Token**: 访问令牌,用于 API 鉴权
- **Refresh Token**: 刷新令牌,用于获取新的 Access Token
- **Rate Limiting**: 限流,限制单位时间内的请求次数
- **CORS**: Cross-Origin Resource Sharing,跨域资源共享

---

**文档状态**: ✅ 已完成
**审批人**: Team Lead
**审批时间**: 待定

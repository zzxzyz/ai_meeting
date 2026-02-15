# REQ-001 用户认证 API 契约

## 文档信息

- **需求编号**: REQ-001
- **需求名称**: 用户认证与授权
- **文档类型**: API 契约
- **版本**: v1.0
- **创建日期**: 2026-02-15
- **作者**: architect
- **状态**: 待评审
- **OpenAPI 版本**: 3.0.0

---

## 概述

本文档定义用户认证相关的 RESTful API 契约，包括：
- 用户注册
- 用户登录
- Token 刷新
- 用户登出
- 获取当前用户信息

所有接口遵循 OpenAPI 3.0 规范，支持自动生成客户端 SDK 和 Mock 服务器。

---

## OpenAPI 规范

```yaml
openapi: 3.0.0
info:
  title: AI Meeting - 用户认证 API
  version: 1.0.0
  description: |
    用户认证相关接口，包括注册、登录、Token 刷新等功能。

    ## 认证方式
    除注册和登录外，其他接口需要在请求头中携带 JWT Token：
    ```
    Authorization: Bearer {access_token}
    ```

    ## Token 机制
    - **Access Token**: 有效期 1 小时，用于 API 访问
    - **Refresh Token**: 有效期 7 天，存储在 HttpOnly Cookie，用于刷新 Access Token

    ## 错误码规范
    错误码采用 5 位数字格式 XYZNN：
    - X: HTTP 状态码首位 (4 或 5)
    - YZ: HTTP 状态码后两位
    - NN: 具体业务错误编号

    示例：40101 = HTTP 401 + 业务错误 01 (邮箱或密码错误)

  contact:
    name: API Support
    email: api@example.com

servers:
  - url: https://api.meeting.example.com/v1
    description: 生产环境
  - url: https://api-test.meeting.example.com/v1
    description: 测试环境
  - url: http://localhost:3000/v1
    description: 开发环境

tags:
  - name: 认证
    description: 用户注册、登录、登出等认证相关接口

paths:
  /auth/register:
    post:
      tags:
        - 认证
      summary: 用户注册
      description: |
        用户通过邮箱、密码和昵称注册账号。

        **密码要求**:
        - 长度：8-32 位
        - 必须包含字母和数字
        - 可包含特殊字符

        **邮箱要求**:
        - 符合标准邮箱格式
        - 不能重复注册

        **限流策略**:
        - 3 次/60 分钟/IP

      operationId: registerUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
                - nickname
              properties:
                email:
                  type: string
                  format: email
                  description: 用户邮箱
                  example: user@example.com
                  maxLength: 255
                password:
                  type: string
                  format: password
                  minLength: 8
                  maxLength: 32
                  description: 用户密码（8-32位，包含字母和数字）
                  example: Password123
                nickname:
                  type: string
                  minLength: 2
                  maxLength: 20
                  description: 用户昵称（2-20个字符）
                  example: 张三
            examples:
              normal:
                summary: 正常注册
                value:
                  email: user@example.com
                  password: Password123
                  nickname: 张三

      responses:
        '201':
          description: 注册成功
          headers:
            Set-Cookie:
              description: Refresh Token (HttpOnly Cookie)
              schema:
                type: string
                example: refresh_token=eyJhbGc...; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    example: 0
                    description: 业务状态码，0 表示成功
                  message:
                    type: string
                    example: 注册成功
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      access_token:
                        type: string
                        description: 访问令牌（有效期 1 小时）
                        example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1Njc4OSIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsIm5pY2tuYW1lIjoi5byg5LiJIiwicm9sZXMiOlsidXNlciJdLCJpYXQiOjE3MDc4OTQwMDAsImV4cCI6MTcwNzg5NzYwMCwianRpIjoidXVpZC12NC10b2tlbi1pZCJ9.signature
                      token_type:
                        type: string
                        example: Bearer
                        description: 令牌类型
                      expires_in:
                        type: integer
                        example: 3600
                        description: Access Token 过期时间（秒）
              examples:
                success:
                  summary: 注册成功
                  value:
                    code: 0
                    message: 注册成功
                    data:
                      user:
                        id: user_123456789
                        email: user@example.com
                        nickname: 张三
                        avatar: null
                        created_at: '2026-02-15T10:00:00Z'
                        updated_at: '2026-02-15T10:00:00Z'
                      access_token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type: Bearer
                      expires_in: 3600

        '400':
          description: 请求参数错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                invalid_email:
                  summary: 邮箱格式不正确
                  value:
                    code: 40001
                    message: 邮箱格式不正确
                invalid_password:
                  summary: 密码格式不正确
                  value:
                    code: 40002
                    message: 密码长度至少 8 位，且包含字母和数字
                invalid_nickname:
                  summary: 昵称格式不正确
                  value:
                    code: 40003
                    message: 昵称长度为 2-20 个字符

        '409':
          description: 邮箱已被注册
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 40901
                message: 邮箱已被注册

        '429':
          description: 请求过于频繁
          headers:
            X-RateLimit-Limit:
              description: 限流阈值
              schema:
                type: integer
                example: 3
            X-RateLimit-Remaining:
              description: 剩余请求次数
              schema:
                type: integer
                example: 0
            X-RateLimit-Reset:
              description: 限流重置时间（Unix 时间戳）
              schema:
                type: integer
                example: 1707897600
            Retry-After:
              description: 重试等待时间（秒）
              schema:
                type: integer
                example: 3600
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 42901
                message: 请求过于频繁，请 60 分钟后再试

        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 50001
                message: 服务器内部错误

  /auth/login:
    post:
      tags:
        - 认证
      summary: 用户登录
      description: |
        用户通过邮箱和密码登录，返回 JWT Token。

        **限流策略**:
        - 5 次/15 分钟/IP
        - 连续 5 次失败后账号锁定 15 分钟

        **安全措施**:
        - 密码使用 bcrypt 验证
        - 记录登录日志（IP、User-Agent）
        - 异常登录检测（地理位置、设备变化）

      operationId: loginUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
              properties:
                email:
                  type: string
                  format: email
                  description: 用户邮箱
                  example: user@example.com
                password:
                  type: string
                  format: password
                  description: 用户密码
                  example: Password123
            examples:
              normal:
                summary: 正常登录
                value:
                  email: user@example.com
                  password: Password123

      responses:
        '200':
          description: 登录成功
          headers:
            Set-Cookie:
              description: Refresh Token (HttpOnly Cookie)
              schema:
                type: string
                example: refresh_token=eyJhbGc...; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    example: 0
                  message:
                    type: string
                    example: 登录成功
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      access_token:
                        type: string
                        description: 访问令牌（有效期 1 小时）
                        example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type:
                        type: string
                        example: Bearer
                      expires_in:
                        type: integer
                        example: 3600
                        description: Access Token 过期时间（秒）
              examples:
                success:
                  summary: 登录成功
                  value:
                    code: 0
                    message: 登录成功
                    data:
                      user:
                        id: user_123456789
                        email: user@example.com
                        nickname: 张三
                        avatar: https://cdn.example.com/avatars/123456789.jpg
                        created_at: '2026-02-13T10:00:00Z'
                        updated_at: '2026-02-14T10:00:00Z'
                      access_token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type: Bearer
                      expires_in: 3600

        '400':
          description: 请求参数错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 40001
                message: 邮箱或密码不能为空

        '401':
          description: 认证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                wrong_credentials:
                  summary: 邮箱或密码错误
                  value:
                    code: 40101
                    message: 邮箱或密码错误
                    data:
                      remaining_attempts: 3
                account_locked:
                  summary: 账户已被锁定
                  value:
                    code: 40102
                    message: 密码错误次数过多，账户已被锁定 15 分钟
                    data:
                      locked_until: '2026-02-15T10:30:00Z'

        '429':
          description: 请求过于频繁
          headers:
            X-RateLimit-Limit:
              schema:
                type: integer
                example: 5
            X-RateLimit-Remaining:
              schema:
                type: integer
                example: 0
            X-RateLimit-Reset:
              schema:
                type: integer
                example: 1707895800
            Retry-After:
              schema:
                type: integer
                example: 900
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 42901
                message: 请求过于频繁，请 15 分钟后再试

        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 50001
                message: 服务器内部错误

  /auth/refresh:
    post:
      tags:
        - 认证
      summary: 刷新 Access Token
      description: |
        使用 Refresh Token 获取新的 Access Token。

        **工作原理**:
        1. 客户端携带 Refresh Token (HttpOnly Cookie) 发起请求
        2. 服务端验证 Refresh Token 有效性
        3. 生成新的 Access Token 和 Refresh Token
        4. 标记旧 Refresh Token 为已使用（防重放攻击）
        5. 返回新 Token

        **安全措施**:
        - Refresh Token 一次性使用
        - 检测到重放攻击时撤销所有 Token
        - 使用分布式锁防止并发刷新

        **限流策略**:
        - 10 次/1 分钟/用户

      operationId: refreshToken
      security:
        - CookieAuth: []
      responses:
        '200':
          description: Token 刷新成功
          headers:
            Set-Cookie:
              description: 新的 Refresh Token (HttpOnly Cookie)
              schema:
                type: string
                example: refresh_token=eyJhbGc...; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    example: 0
                  message:
                    type: string
                    example: Token 刷新成功
                  data:
                    type: object
                    properties:
                      access_token:
                        type: string
                        description: 新的访问令牌
                        example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type:
                        type: string
                        example: Bearer
                      expires_in:
                        type: integer
                        example: 3600
                        description: Access Token 过期时间（秒）
              examples:
                success:
                  summary: 刷新成功
                  value:
                    code: 0
                    message: Token 刷新成功
                    data:
                      access_token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type: Bearer
                      expires_in: 3600

        '401':
          description: Refresh Token 无效或已过期
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                token_expired:
                  summary: Token 已过期
                  value:
                    code: 40102
                    message: Refresh Token 已过期，请重新登录
                token_invalid:
                  summary: Token 无效
                  value:
                    code: 40103
                    message: Refresh Token 无效
                token_used:
                  summary: 检测到重放攻击
                  value:
                    code: 40104
                    message: 检测到异常，已撤销所有 Token，请重新登录

        '429':
          description: 请求过于频繁
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 42901
                message: 请求过于频繁，请稍后再试

        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 50001
                message: 服务器内部错误

  /auth/logout:
    post:
      tags:
        - 认证
      summary: 用户登出
      description: |
        用户登出，使当前 Token 失效。

        **处理逻辑**:
        1. 将 Access Token 加入黑名单（Redis，过期时间同 Token）
        2. 撤销数据库中的 Refresh Token
        3. 清除客户端 Refresh Token Cookie

        **注意**:
        - Access Token 在过期前仍可能被使用（黑名单机制）
        - Refresh Token 立即失效

      operationId: logoutUser
      security:
        - BearerAuth: []
        - CookieAuth: []
      responses:
        '200':
          description: 登出成功
          headers:
            Set-Cookie:
              description: 清除 Refresh Token Cookie
              schema:
                type: string
                example: refresh_token=; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=0
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    example: 0
                  message:
                    type: string
                    example: 登出成功
              examples:
                success:
                  summary: 登出成功
                  value:
                    code: 0
                    message: 登出成功

        '401':
          description: 未认证或 Token 无效
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 40103
                message: Token 无效或已过期

        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 50001
                message: 服务器内部错误

  /users/me:
    get:
      tags:
        - 认证
      summary: 获取当前用户信息
      description: |
        获取当前登录用户的详细信息。

        **使用场景**:
        - 客户端初始化时获取用户信息
        - 用户信息更新后刷新显示

        **性能优化**:
        - 用户信息可缓存在客户端
        - 仅在必要时调用此接口

      operationId: getCurrentUser
      security:
        - BearerAuth: []
      responses:
        '200':
          description: 成功获取用户信息
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    example: 0
                  message:
                    type: string
                    example: 成功
                  data:
                    $ref: '#/components/schemas/User'
              examples:
                success:
                  summary: 获取成功
                  value:
                    code: 0
                    message: 成功
                    data:
                      id: user_123456789
                      email: user@example.com
                      nickname: 张三
                      avatar: https://cdn.example.com/avatars/123456789.jpg
                      created_at: '2026-02-13T10:00:00Z'
                      updated_at: '2026-02-14T10:00:00Z'

        '401':
          description: 未认证或 Token 无效
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                token_missing:
                  summary: 缺少 Token
                  value:
                    code: 40100
                    message: 缺少认证 Token
                token_expired:
                  summary: Token 已过期
                  value:
                    code: 40102
                    message: Token 已过期
                token_invalid:
                  summary: Token 无效
                  value:
                    code: 40103
                    message: Token 无效

        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 50001
                message: 服务器内部错误

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        使用 JWT Access Token 进行认证。
        在请求头中添加：
        ```
        Authorization: Bearer {access_token}
        ```

    CookieAuth:
      type: apiKey
      in: cookie
      name: refresh_token
      description: |
        使用 Refresh Token Cookie 进行认证。
        Cookie 为 HttpOnly，客户端无需手动处理。

  schemas:
    User:
      type: object
      description: 用户信息
      required:
        - id
        - email
        - nickname
        - created_at
        - updated_at
      properties:
        id:
          type: string
          description: 用户 ID
          example: user_123456789
          pattern: '^user_[0-9]+$'
        email:
          type: string
          format: email
          description: 用户邮箱
          example: user@example.com
        nickname:
          type: string
          minLength: 2
          maxLength: 20
          description: 用户昵称
          example: 张三
        avatar:
          type: string
          format: uri
          nullable: true
          description: 用户头像 URL
          example: https://cdn.example.com/avatars/123456789.jpg
        created_at:
          type: string
          format: date-time
          description: 创建时间（ISO 8601 格式）
          example: '2026-02-13T10:00:00Z'
        updated_at:
          type: string
          format: date-time
          description: 更新时间（ISO 8601 格式）
          example: '2026-02-14T10:00:00Z'

    Error:
      type: object
      description: 错误响应
      required:
        - code
        - message
      properties:
        code:
          type: integer
          description: 错误码（5 位数字）
          example: 40101
        message:
          type: string
          description: 错误消息
          example: 邮箱或密码错误
        data:
          type: object
          description: 附加错误信息（可选）
          additionalProperties: true
          example:
            remaining_attempts: 3
```

---

## 错误码汇总

### HTTP 错误码

| 错误码 | HTTP 状态 | 说明 | 使用场景 |
|--------|----------|------|---------|
| 0 | 200/201 | 成功 | 所有成功响应 |
| 40001 | 400 | 邮箱格式不正确 | 注册、登录 |
| 40002 | 400 | 密码格式不正确 | 注册 |
| 40003 | 400 | 昵称格式不正确 | 注册 |
| 40100 | 401 | 缺少认证 Token | 需要认证的接口 |
| 40101 | 401 | 邮箱或密码错误 | 登录 |
| 40102 | 401 | Token 已过期 | Token 验证 |
| 40103 | 401 | Token 无效 | Token 验证 |
| 40104 | 401 | 检测到重放攻击 | Refresh Token |
| 40901 | 409 | 邮箱已被注册 | 注册 |
| 42901 | 429 | 请求过于频繁 | 所有接口 |
| 50001 | 500 | 服务器内部错误 | 所有接口 |

---

## 请求示例

### 1. 用户注册

**请求**:
```bash
curl -X POST https://api.meeting.example.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "nickname": "张三"
  }'
```

**响应**:
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "user": {
      "id": "user_123456789",
      "email": "user@example.com",
      "nickname": "张三",
      "avatar": null,
      "created_at": "2026-02-15T10:00:00Z",
      "updated_at": "2026-02-15T10:00:00Z"
    },
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

**Set-Cookie 响应头**:
```
Set-Cookie: refresh_token=eyJhbGc...; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 2. 用户登录

**请求**:
```bash
curl -X POST https://api.meeting.example.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

**响应**: 与注册相同

---

### 3. Token 刷新

**请求**:
```bash
curl -X POST https://api.meeting.example.com/v1/auth/refresh \
  -H "Cookie: refresh_token=eyJhbGc..."
```

**响应**:
```json
{
  "code": 0,
  "message": "Token 刷新成功",
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

---

### 4. 用户登出

**请求**:
```bash
curl -X POST https://api.meeting.example.com/v1/auth/logout \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Cookie: refresh_token=eyJhbGc..."
```

**响应**:
```json
{
  "code": 0,
  "message": "登出成功"
}
```

---

### 5. 获取当前用户信息

**请求**:
```bash
curl -X GET https://api.meeting.example.com/v1/users/me \
  -H "Authorization: Bearer eyJhbGc..."
```

**响应**:
```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "user_123456789",
    "email": "user@example.com",
    "nickname": "张三",
    "avatar": "https://cdn.example.com/avatars/123456789.jpg",
    "created_at": "2026-02-13T10:00:00Z",
    "updated_at": "2026-02-14T10:00:00Z"
  }
}
```

---

## 安全性说明

### 1. Token 安全

**Access Token**:
- 存储位置：客户端内存（不持久化）
- 传输方式：HTTP Header `Authorization: Bearer <token>`
- 有效期：1 小时
- 签名算法：RS256（RSA 2048位 + SHA-256）

**Refresh Token**:
- 存储位置：HttpOnly Cookie
- 传输方式：自动携带（浏览器处理）
- 有效期：7 天
- 签名算法：RS256
- 安全措施：
  - `HttpOnly`: 防止 JavaScript 访问
  - `Secure`: 仅 HTTPS 传输
  - `SameSite=Strict`: 防止 CSRF 攻击
  - 一次性使用：防止重放攻击

### 2. 密码安全

- 算法：bcrypt
- Cost Factor：12
- 加盐：自动生成随机盐
- 验证时间：约 400ms（防暴力破解）

### 3. 限流策略

| 接口 | 限制 | 窗口期 |
|------|------|-------|
| 注册 | 3 次 | 60 分钟 |
| 登录 | 5 次 | 15 分钟 |
| 刷新 | 10 次 | 1 分钟 |

### 4. 账户锁定

- 触发条件：连续 5 次登录失败
- 锁定时长：15 分钟
- 解锁方式：时间到期自动解锁

---

## 客户端集成指南

### 1. Token 存储

**推荐方案**:
```typescript
// Access Token 存储在内存
let accessToken: string | null = null;

// Refresh Token 由浏览器自动管理（HttpOnly Cookie）
```

### 2. 请求拦截器

```typescript
// Axios 示例
axios.interceptors.request.use(config => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
```

### 3. 响应拦截器（自动刷新）

```typescript
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && error.response?.data?.code === 40102) {
      // Token 过期，尝试刷新
      try {
        const { data } = await axios.post('/auth/refresh');
        accessToken = data.data.access_token;

        // 重试原请求
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return axios.request(error.config);
      } catch (refreshError) {
        // 刷新失败，跳转登录页
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```

### 4. 主动刷新（推荐）

```typescript
// 定时检查 Token 是否即将过期
setInterval(async () => {
  if (!accessToken) return;

  // 解析 Token（使用 jwt-decode）
  const decoded = jwtDecode(accessToken);
  const expiresIn = decoded.exp * 1000 - Date.now();

  // 提前 5 分钟刷新
  if (expiresIn < 5 * 60 * 1000) {
    try {
      const { data } = await axios.post('/auth/refresh');
      accessToken = data.data.access_token;
    } catch (error) {
      // 刷新失败，跳转登录页
      window.location.href = '/login';
    }
  }
}, 60 * 1000); // 每分钟检查一次
```

---

## 测试用例

### 1. 注册测试

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 正常注册 | 有效邮箱、密码、昵称 | 201, 返回用户信息和 Token |
| 邮箱格式错误 | invalid-email | 400, code=40001 |
| 密码过短 | 123 | 400, code=40002 |
| 昵称过长 | 超过 20 字符 | 400, code=40003 |
| 邮箱重复 | 已注册的邮箱 | 409, code=40901 |
| 限流测试 | 1小时内注册 4 次 | 429, code=42901 |

### 2. 登录测试

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 正常登录 | 正确邮箱和密码 | 200, 返回 Token |
| 邮箱不存在 | 未注册邮箱 | 401, code=40101 |
| 密码错误 | 错误密码 | 401, code=40101 |
| 连续失败 5 次 | 5 次错误密码 | 401, code=40102, 账户锁定 |
| 锁定期间登录 | 锁定账户 | 401, code=40102 |
| 限流测试 | 15分钟内登录 6 次 | 429, code=42901 |

### 3. Token 刷新测试

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 正常刷新 | 有效 Refresh Token | 200, 返回新 Token |
| Token 过期 | 过期 Refresh Token | 401, code=40102 |
| Token 无效 | 伪造 Token | 401, code=40103 |
| Token 重复使用 | 已使用的 Token | 401, code=40104, 撤销所有 Token |
| 并发刷新 | 同时多个请求 | 仅一个成功,其他失败 |

### 4. 登出测试

| 用例 | 输入 | 预期结果 |
|------|------|---------|
| 正常登出 | 有效 Token | 200, Token 加入黑名单 |
| 登出后访问 | 已登出的 Token | 401, code=40103 |

---

## 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-02-15 | 初始版本，定义认证接口契约 | architect |

---

## 下一步工作

- [ ] 后端实现 API 接口
- [ ] 搭建 Prism Mock Server
- [ ] 前端集成认证流程
- [ ] 编写集成测试
- [ ] 编写 Postman 测试集合

---

**文档版本**: v1.0
**创建日期**: 2026-02-15
**审核状态**: 待评审
**维护人**: architect

# API 契约初稿 - MVP v0.1

## 文档信息

- **版本**: v1.0（初稿）
- **状态**: draft（待评审）
- **创建日期**: 2026-02-14
- **评审日期**: Week 1 周三
- **负责人**: Backend Lead

## 概述

本文档定义 AI Meeting MVP v0.1 的核心 API 契约，包括：

1. **RESTful API**：用户认证、会议管理
2. **WebSocket API**：实时信令、聊天消息
3. **SDK 接口**：客户端 SDK TypeScript 定义

---

## 1. RESTful API 契约

### 1.1 基本信息

**OpenAPI 版本**: 3.0.0
**API 版本**: v1
**Base URL**:
- 生产环境: `https://api.meeting.example.com/v1`
- 测试环境: `https://api-test.meeting.example.com/v1`
- 开发环境: `http://localhost:3000/v1`

### 1.2 OpenAPI 规范

```yaml
openapi: 3.0.0
info:
  title: AI Meeting API
  version: 1.0.0
  description: |
    企业级视频会议系统 RESTful API

    ## 认证方式
    大部分接口需要 JWT Token 认证，在请求头中携带：
    ```
    Authorization: Bearer {access_token}
    ```

    ## 错误码规范
    错误码采用 5 位数字格式 XYZNN：
    - X: HTTP 状态码首位
    - YZ: HTTP 状态码后两位
    - NN: 具体业务错误

    示例：40101 = HTTP 401 + 业务错误 01
  contact:
    name: API Support
    email: api@example.com
  license:
    name: Private

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
  - name: 用户
    description: 用户信息管理
  - name: 会议
    description: 会议创建、加入、管理等接口

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

        **邮箱要求**:
        - 符合标准邮箱格式
        - 不能重复注册
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
                  description: 用户昵称
                  example: 张三
      responses:
        '201':
          description: 注册成功
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
                    example: 注册成功
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      tokens:
                        $ref: '#/components/schemas/TokenPair'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          $ref: '#/components/responses/Conflict'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/login:
    post:
      tags:
        - 认证
      summary: 用户登录
      description: |
        用户通过邮箱和密码登录，返回 JWT Token。

        **限流策略**:
        - 5 次/分钟/IP
        - 连续 5 次失败后账号锁定 15 分钟
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
                  example: user@example.com
                password:
                  type: string
                  format: password
                  example: Password123
      responses:
        '200':
          description: 登录成功
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
                      tokens:
                        $ref: '#/components/schemas/TokenPair'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/refresh:
    post:
      tags:
        - 认证
      summary: 刷新 Token
      description: |
        使用 Refresh Token 获取新的 Access Token。

        **Token 有效期**:
        - Access Token: 1 小时
        - Refresh Token: 7 天
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - refresh_token
              properties:
                refresh_token:
                  type: string
                  description: Refresh Token
                  example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      responses:
        '200':
          description: Token 刷新成功
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
                        example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type:
                        type: string
                        example: Bearer
                      expires_in:
                        type: integer
                        description: 过期时间（秒）
                        example: 3600
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /auth/logout:
    post:
      tags:
        - 认证
      summary: 用户登出
      description: 使 Token 失效（加入黑名单）
      operationId: logoutUser
      security:
        - BearerAuth: []
      responses:
        '200':
          description: 登出成功
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
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /users/me:
    get:
      tags:
        - 用户
      summary: 获取当前用户信息
      description: 获取当前登录用户的详细信息
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
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /meetings:
    post:
      tags:
        - 会议
      summary: 创建会议
      description: |
        创建新会议，返回会议号和会议详情。

        **会议号规则**:
        - 9 位数字
        - 全局唯一
        - 有效期 24 小时（未开始的会议）
      operationId: createMeeting
      security:
        - BearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                  maxLength: 100
                  description: 会议主题（可选）
                  example: 每周例会
      responses:
        '201':
          description: 会议创建成功
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
                    example: 会议创建成功
                  data:
                    $ref: '#/components/schemas/Meeting'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

    get:
      tags:
        - 会议
      summary: 获取会议列表
      description: |
        获取用户的会议列表，支持分页和筛选。

        **筛选类型**:
        - `my`: 我创建的会议
        - `history`: 我参加过的会议
      operationId: getMeetings
      security:
        - BearerAuth: []
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [my, history]
            default: my
          description: 会议类型
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
          description: 页码
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
          description: 每页数量
      responses:
        '200':
          description: 成功获取会议列表
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
                    type: object
                    properties:
                      meetings:
                        type: array
                        items:
                          $ref: '#/components/schemas/Meeting'
                      pagination:
                        $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /meetings/{meeting_number}/join:
    post:
      tags:
        - 会议
      summary: 加入会议
      description: |
        通过会议号加入会议。

        **加入条件**:
        - 会议号有效
        - 会议状态为 waiting 或 active
        - 参与人数未达上限（当前 4 人）
      operationId: joinMeeting
      security:
        - BearerAuth: []
      parameters:
        - name: meeting_number
          in: path
          required: true
          schema:
            type: string
            pattern: '^\d{9}$'
          description: 9 位会议号
          example: "123456789"
      responses:
        '200':
          description: 成功加入会议
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
                    example: 成功加入会议
                  data:
                    $ref: '#/components/schemas/MeetingDetail'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /meetings/{meeting_id}:
    get:
      tags:
        - 会议
      summary: 获取会议详情
      description: 获取指定会议的详细信息
      operationId: getMeetingDetail
      security:
        - BearerAuth: []
      parameters:
        - name: meeting_id
          in: path
          required: true
          schema:
            type: string
          description: 会议 ID
      responses:
        '200':
          description: 成功获取会议详情
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
                    $ref: '#/components/schemas/MeetingDetail'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /meetings/{meeting_id}/end:
    post:
      tags:
        - 会议
      summary: 结束会议
      description: |
        结束会议（仅创建者可操作）。

        **结束后**:
        - 会议状态变为 ended
        - 所有参与者自动退出
        - WebSocket 连接断开
      operationId: endMeeting
      security:
        - BearerAuth: []
      parameters:
        - name: meeting_id
          in: path
          required: true
          schema:
            type: string
          description: 会议 ID
      responses:
        '200':
          description: 会议已结束
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
                    example: 会议已结束
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalServerError'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        使用 JWT Token 进行认证。
        在请求头中添加：
        ```
        Authorization: Bearer {access_token}
        ```

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          description: 用户 ID
          example: "user_123456789"
        email:
          type: string
          format: email
          description: 用户邮箱
          example: user@example.com
        nickname:
          type: string
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
          description: 创建时间
          example: "2026-02-13T10:00:00Z"
        updated_at:
          type: string
          format: date-time
          description: 更新时间
          example: "2026-02-14T10:00:00Z"

    TokenPair:
      type: object
      properties:
        access_token:
          type: string
          description: 访问令牌（有效期 1 小时）
          example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        refresh_token:
          type: string
          description: 刷新令牌（有效期 7 天）
          example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        token_type:
          type: string
          description: 令牌类型
          example: Bearer
        expires_in:
          type: integer
          description: 访问令牌过期时间（秒）
          example: 3600

    Meeting:
      type: object
      properties:
        id:
          type: string
          description: 会议 ID
          example: "meeting_123456789"
        meeting_number:
          type: string
          description: 9 位会议号
          example: "123456789"
        title:
          type: string
          nullable: true
          description: 会议主题
          example: 每周例会
        creator_id:
          type: string
          description: 创建者 ID
          example: "user_123456789"
        status:
          type: string
          enum: [waiting, active, ended]
          description: |
            会议状态：
            - waiting: 等待中（已创建，无人加入）
            - active: 进行中（有人已加入）
            - ended: 已结束
          example: waiting
        started_at:
          type: string
          format: date-time
          nullable: true
          description: 开始时间
          example: "2026-02-14T10:00:00Z"
        ended_at:
          type: string
          format: date-time
          nullable: true
          description: 结束时间
          example: "2026-02-14T11:30:00Z"
        created_at:
          type: string
          format: date-time
          description: 创建时间
          example: "2026-02-14T09:50:00Z"

    MeetingDetail:
      allOf:
        - $ref: '#/components/schemas/Meeting'
        - type: object
          properties:
            participants:
              type: array
              items:
                $ref: '#/components/schemas/Participant'
              description: 参与者列表
            participant_count:
              type: integer
              description: 参与人数
              example: 3

    Participant:
      type: object
      properties:
        user_id:
          type: string
          description: 用户 ID
          example: "user_123456789"
        nickname:
          type: string
          description: 用户昵称
          example: 张三
        avatar:
          type: string
          format: uri
          nullable: true
          description: 用户头像
          example: https://cdn.example.com/avatars/123456789.jpg
        joined_at:
          type: string
          format: date-time
          description: 加入时间
          example: "2026-02-14T10:05:00Z"
        audio_muted:
          type: boolean
          description: 是否静音
          example: false
        video_muted:
          type: boolean
          description: 是否关闭摄像头
          example: false

    Pagination:
      type: object
      properties:
        page:
          type: integer
          description: 当前页码
          example: 1
        limit:
          type: integer
          description: 每页数量
          example: 20
        total:
          type: integer
          description: 总记录数
          example: 100
        total_pages:
          type: integer
          description: 总页数
          example: 5

    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          description: 错误码
        message:
          type: string
          description: 错误消息
        details:
          type: object
          description: 详细错误信息（可选）

  responses:
    BadRequest:
      description: 请求参数错误
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            invalid_email:
              value:
                code: 40001
                message: 邮箱格式不正确
            invalid_password:
              value:
                code: 40002
                message: 密码长度至少 8 位，且包含字母和数字
            missing_field:
              value:
                code: 40003
                message: 缺少必填字段

    Unauthorized:
      description: 未认证或认证失败
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            wrong_credentials:
              value:
                code: 40101
                message: 邮箱或密码错误
            token_expired:
              value:
                code: 40102
                message: Token 已过期
            token_invalid:
              value:
                code: 40103
                message: Token 无效

    Forbidden:
      description: 无权限
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            no_permission:
              value:
                code: 40301
                message: 无权限执行此操作

    NotFound:
      description: 资源不存在
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            user_not_found:
              value:
                code: 40401
                message: 用户不存在
            meeting_not_found:
              value:
                code: 40402
                message: 会议不存在

    Conflict:
      description: 资源冲突
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          examples:
            email_exists:
              value:
                code: 40901
                message: 邮箱已被注册

    TooManyRequests:
      description: 请求过于频繁
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: 42901
            message: 请求过于频繁，请稍后再试

    InternalServerError:
      description: 服务器内部错误
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            code: 50001
            message: 服务器内部错误
```

---

## 2. WebSocket API 契约

### 2.1 连接建立

**URL**: `wss://api.meeting.example.com/v1/ws`

**认证方式**: Query 参数传递 Token
```
wss://api.meeting.example.com/v1/ws?access_token={JWT_TOKEN}
```

**连接流程**:
1. 客户端携带 `access_token` 建立 WebSocket 连接
2. 服务端验证 Token
3. 验证成功后连接建立，服务端发送 `connected` 消息
4. 验证失败则断开连接，返回错误码

**心跳机制**:
- 客户端每 30 秒发送 `ping` 消息
- 服务端响应 `pong` 消息
- 超过 60 秒无心跳则服务端断开连接

### 2.2 消息格式

所有 WebSocket 消息采用统一 JSON 格式：

```json
{
  "type": "message_type",
  "seq": 123456,
  "timestamp": 1707894000000,
  "data": {}
}
```

**字段说明**:
- `type` (string, required): 消息类型
- `seq` (integer, required): 消息序列号（递增，用于排序和去重）
- `timestamp` (integer, required): Unix 毫秒时间戳
- `data` (object, required): 消息体

### 2.3 消息类型

#### 2.3.1 客户端 → 服务端

| 消息类型 | 说明 | data 字段 |
|---------|------|----------|
| `ping` | 心跳 | 无 |
| `join_room` | 加入会议房间 | `room_id` |
| `leave_room` | 离开会议房间 | `room_id` |
| `media_control` | 音视频控制 | `room_id`, `action`, `value` |
| `chat_message` | 发送聊天消息 | `room_id`, `content` |

#### 2.3.2 服务端 → 客户端

| 消息类型 | 说明 | data 字段 |
|---------|------|----------|
| `connected` | 连接成功 | `user_id` |
| `pong` | 心跳响应 | 无 |
| `user_joined` | 用户加入通知 | `user`, `room_id`, `participant_count` |
| `user_left` | 用户离开通知 | `user_id`, `room_id`, `participant_count` |
| `media_state_changed` | 音视频状态变化 | `user_id`, `room_id`, `audio_muted`, `video_muted` |
| `chat_message` | 聊天消息 | `message_id`, `room_id`, `sender`, `content`, `created_at` |
| `error` | 错误消息 | `code`, `message`, `request_seq` |

### 2.4 消息示例

#### 连接成功

服务端 → 客户端:
```json
{
  "type": "connected",
  "seq": 1,
  "timestamp": 1707894000000,
  "data": {
    "user_id": "user_123456789"
  }
}
```

#### 加入会议房间

客户端 → 服务端:
```json
{
  "type": "join_room",
  "seq": 1,
  "timestamp": 1707894001000,
  "data": {
    "room_id": "meeting_123456789"
  }
}
```

服务端 → 所有客户端（广播）:
```json
{
  "type": "user_joined",
  "seq": 100,
  "timestamp": 1707894001100,
  "data": {
    "user": {
      "id": "user_123456789",
      "nickname": "张三",
      "avatar": "https://cdn.example.com/avatars/123456789.jpg"
    },
    "room_id": "meeting_123456789",
    "participant_count": 3
  }
}
```

#### 音视频控制

客户端 → 服务端:
```json
{
  "type": "media_control",
  "seq": 2,
  "timestamp": 1707894010000,
  "data": {
    "room_id": "meeting_123456789",
    "action": "mute_audio",
    "value": true
  }
}
```

服务端 → 所有客户端（广播）:
```json
{
  "type": "media_state_changed",
  "seq": 101,
  "timestamp": 1707894010100,
  "data": {
    "user_id": "user_123456789",
    "room_id": "meeting_123456789",
    "audio_muted": true,
    "video_muted": false
  }
}
```

#### 发送聊天消息

客户端 → 服务端:
```json
{
  "type": "chat_message",
  "seq": 3,
  "timestamp": 1707894020000,
  "data": {
    "room_id": "meeting_123456789",
    "content": "大家好！"
  }
}
```

服务端 → 所有客户端（广播）:
```json
{
  "type": "chat_message",
  "seq": 102,
  "timestamp": 1707894020100,
  "data": {
    "message_id": "msg_001",
    "room_id": "meeting_123456789",
    "sender": {
      "id": "user_123456789",
      "nickname": "张三",
      "avatar": "https://cdn.example.com/avatars/123456789.jpg"
    },
    "content": "大家好！",
    "created_at": "2026-02-14T10:00:20Z"
  }
}
```

#### 错误消息

服务端 → 客户端:
```json
{
  "type": "error",
  "seq": 103,
  "timestamp": 1707894030000,
  "data": {
    "code": 40402,
    "message": "会议不存在",
    "request_seq": 1
  }
}
```

---

## 3. SDK 接口契约（TypeScript）

以下是客户端 SDK 的 TypeScript 接口定义，其他平台（Swift/Kotlin/C++）需保持接口语义一致。

```typescript
/**
 * 会议 SDK 主接口
 */
export interface MeetingSDK {
  /**
   * 初始化 SDK
   * @param config SDK 配置
   * @returns Promise<void>
   * @throws {MeetingError} 初始化失败
   */
  initialize(config: SDKConfig): Promise<void>;

  /**
   * 创建会议
   * @param options 会议选项
   * @returns Promise<Meeting>
   * @throws {MeetingError} 创建失败
   */
  createMeeting(options?: CreateMeetingOptions): Promise<Meeting>;

  /**
   * 加入会议
   * @param meetingNumber 9位会议号
   * @param options 加入选项
   * @returns Promise<Meeting>
   * @throws {MeetingError} 加入失败
   */
  joinMeeting(meetingNumber: string, options?: JoinMeetingOptions): Promise<Meeting>;

  /**
   * 获取设备列表
   * @returns Promise<MediaDevices>
   */
  getDevices(): Promise<MediaDevices>;

  /**
   * 设置日志级别
   * @param level 日志级别
   */
  setLogLevel(level: LogLevel): void;

  /**
   * 销毁 SDK
   * @returns Promise<void>
   */
  destroy(): Promise<void>;
}

/**
 * SDK 配置
 */
export interface SDKConfig {
  /** API 服务器地址 */
  apiServer: string;
  /** WebSocket 服务器地址 */
  wsServer: string;
  /** STUN 服务器地址（可选） */
  stunServers?: string[];
  /** TURN 服务器配置（可选） */
  turnServers?: TURNServer[];
  /** 日志级别（可选） */
  logLevel?: LogLevel;
}

/**
 * 创建会议选项
 */
export interface CreateMeetingOptions {
  /** 会议主题（可选） */
  title?: string;
}

/**
 * 加入会议选项
 */
export interface JoinMeetingOptions {
  /** 是否静音（默认 false） */
  audioMuted?: boolean;
  /** 是否关闭摄像头（默认 false） */
  videoMuted?: boolean;
}

/**
 * 会议接口
 */
export interface Meeting {
  /** 会议 ID */
  readonly id: string;
  /** 会议号 */
  readonly meetingNumber: string;
  /** 会议主题 */
  readonly title: string | null;
  /** 会议状态 */
  readonly state: MeetingState;
  /** 参与者列表 */
  readonly participants: Participant[];

  /**
   * 离开会议
   * @returns Promise<void>
   */
  leave(): Promise<void>;

  /**
   * 静音/取消静音
   * @param muted 是否静音
   * @returns Promise<void>
   */
  muteAudio(muted: boolean): Promise<void>;

  /**
   * 关闭/开启摄像头
   * @param muted 是否关闭
   * @returns Promise<void>
   */
  muteVideo(muted: boolean): Promise<void>;

  /**
   * 发送聊天消息
   * @param content 消息内容
   * @returns Promise<void>
   */
  sendChatMessage(content: string): Promise<void>;

  /**
   * 监听事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  on(event: MeetingEvent, handler: EventHandler): void;

  /**
   * 取消监听
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: MeetingEvent, handler: EventHandler): void;
}

/**
 * 会议状态
 */
export enum MeetingState {
  /** 等待中 */
  WAITING = 'waiting',
  /** 进行中 */
  ACTIVE = 'active',
  /** 已结束 */
  ENDED = 'ended',
}

/**
 * 参与者信息
 */
export interface Participant {
  /** 用户 ID */
  userId: string;
  /** 昵称 */
  nickname: string;
  /** 头像 URL */
  avatar: string | null;
  /** 是否静音 */
  audioMuted: boolean;
  /** 是否关闭摄像头 */
  videoMuted: boolean;
  /** 加入时间 */
  joinedAt: Date;
}

/**
 * 会议事件
 */
export enum MeetingEvent {
  /** 用户加入 */
  USER_JOINED = 'user_joined',
  /** 用户离开 */
  USER_LEFT = 'user_left',
  /** 收到聊天消息 */
  CHAT_MESSAGE = 'chat_message',
  /** 音视频状态变化 */
  MEDIA_STATE_CHANGED = 'media_state_changed',
  /** 网络质量变化 */
  NETWORK_QUALITY_CHANGED = 'network_quality_changed',
  /** 错误 */
  ERROR = 'error',
}

/**
 * 事件处理函数类型
 */
export type EventHandler = (event: any) => void;

/**
 * 媒体设备信息
 */
export interface MediaDevices {
  /** 摄像头列表 */
  videoDevices: MediaDeviceInfo[];
  /** 麦克风列表 */
  audioInputDevices: MediaDeviceInfo[];
  /** 扬声器列表 */
  audioOutputDevices: MediaDeviceInfo[];
}

/**
 * 设备信息
 */
export interface MediaDeviceInfo {
  /** 设备 ID */
  deviceId: string;
  /** 设备名称 */
  label: string;
  /** 设备类型 */
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
}

/**
 * TURN 服务器配置
 */
export interface TURNServer {
  /** 服务器地址 */
  urls: string[];
  /** 用户名 */
  username?: string;
  /** 密码 */
  credential?: string;
}

/**
 * 日志级别
 */
export enum LogLevel {
  /** 调试 */
  DEBUG = 'debug',
  /** 信息 */
  INFO = 'info',
  /** 警告 */
  WARN = 'warn',
  /** 错误 */
  ERROR = 'error',
}

/**
 * SDK 错误类
 */
export class MeetingError extends Error {
  /** 错误码 */
  readonly code: SDKErrorCode;
  /** 错误消息 */
  readonly message: string;
  /** 详细信息 */
  readonly details?: any;

  constructor(code: SDKErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'MeetingError';
    this.code = code;
    this.details = details;
  }
}

/**
 * SDK 错误码
 */
export enum SDKErrorCode {
  /** 初始化失败 */
  INIT_FAILED = 10001,
  /** 网络连接失败 */
  NETWORK_ERROR = 10002,
  /** 权限被拒绝 */
  PERMISSION_DENIED = 10003,
  /** 设备不可用 */
  DEVICE_UNAVAILABLE = 10004,
  /** 会议不存在 */
  MEETING_NOT_FOUND = 10005,
  /** 参数错误 */
  INVALID_ARGUMENT = 10006,
}
```

---

## 4. 错误码汇总

### 4.1 HTTP 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| 40001 | 400 | 邮箱格式不正确 |
| 40002 | 400 | 密码长度不足或格式错误 |
| 40003 | 400 | 缺少必填字段 |
| 40101 | 401 | 邮箱或密码错误 |
| 40102 | 401 | Token 已过期 |
| 40103 | 401 | Token 无效 |
| 40301 | 403 | 无权限执行此操作 |
| 40401 | 404 | 用户不存在 |
| 40402 | 404 | 会议不存在 |
| 40901 | 409 | 邮箱已被注册 |
| 42901 | 429 | 请求过于频繁 |
| 50001 | 500 | 服务器内部错误 |

### 4.2 WebSocket 错误码

与 HTTP 错误码保持一致，在 `error` 消息的 `data.code` 字段返回。

### 4.3 SDK 错误码

| 错误码 | 说明 |
|--------|------|
| 10001 | 初始化失败 |
| 10002 | 网络连接失败 |
| 10003 | 权限被拒绝 |
| 10004 | 设备不可用 |
| 10005 | 会议不存在 |
| 10006 | 参数错误 |

---

## 5. 数据库设计（参考）

### 5.1 users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) PK | 用户 ID |
| email | VARCHAR(255) UNIQUE | 邮箱 |
| password_hash | VARCHAR(255) | 密码哈希（bcrypt） |
| nickname | VARCHAR(50) | 昵称 |
| avatar | TEXT | 头像 URL |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.2 meetings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) PK | 会议 ID |
| meeting_number | VARCHAR(9) UNIQUE | 会议号 |
| title | VARCHAR(100) | 会议主题 |
| creator_id | VARCHAR(50) FK | 创建者 ID |
| status | ENUM | waiting/active/ended |
| started_at | TIMESTAMP | 开始时间 |
| ended_at | TIMESTAMP | 结束时间 |
| created_at | TIMESTAMP | 创建时间 |

### 5.3 participants 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) PK | 记录 ID |
| meeting_id | VARCHAR(50) FK | 会议 ID |
| user_id | VARCHAR(50) FK | 用户 ID |
| joined_at | TIMESTAMP | 加入时间 |
| left_at | TIMESTAMP | 离开时间 |

---

## 6. 下一步工作

### 6.1 评审通过后

- [ ] 后端 Leader: 搭建 Prism Mock Server
- [ ] 后端 Leader: 生成 OpenAPI 文档（Swagger UI）
- [ ] 前端 Leader: 基于契约开始前端开发
- [ ] 客户端 Leader: 基于契约开始 SDK 封装
- [ ] 测试 Leader: 编写契约测试用例

### 6.2 契约变更流程

1. 提出变更 PR（修改本文档）
2. 通知所有相关 Team Leader
3. 重新评审
4. 评审通过后合并
5. 更新 Mock Server 和文档
6. 各 Team 更新代码

---

**文档版本**: v1.0（初稿）
**创建日期**: 2026-02-14
**状态**: 待评审
**下次评审**: Week 1 周三

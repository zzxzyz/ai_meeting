# API 接口契约模板

## 文档说明

本文档定义视频会议系统的 API 接口契约标准,所有 Team 在设计和实现接口时必须遵循此规范。

## 契约原则

1. **契约先行**: 接口定义先于实现,评审通过后方可开发
2. **版本管理**: 接口支持版本控制,向后兼容
3. **文档驱动**: 接口文档作为开发和测试依据
4. **Mock 优先**: 基于契约可生成 Mock 数据,支持并行开发
5. **自动化验证**: 接口实现需通过契约测试

## 契约类型

### RESTful API 契约

用于 HTTP/HTTPS 同步请求响应场景。

### WebSocket 契约

用于实时双向通信场景(信令、聊天消息)。

### SDK 接口契约

用于客户端 SDK 对外暴露的接口。

---

## RESTful API 契约规范

### 1. 基本信息

每个 API 契约文档必须包含:

```yaml
# API 契约基本信息
api_name: 用户登录
api_id: auth.login
version: v1
owner_team: 后端 Team
status: draft | review | approved | deprecated
created_date: 2026-02-13
updated_date: 2026-02-13
```

### 2. 接口定义 (OpenAPI 3.0)

使用 OpenAPI 3.0 规范定义接口。

#### 示例: 用户登录

```yaml
openapi: 3.0.0
info:
  title: 用户认证 API
  version: 1.0.0
  description: 用户注册、登录、登出等认证相关接口

servers:
  - url: https://api.meeting.example.com/v1
    description: 生产环境
  - url: https://api-test.meeting.example.com/v1
    description: 测试环境

paths:
  /auth/login:
    post:
      summary: 用户登录
      description: 用户通过邮箱和密码登录,返回 JWT Token
      operationId: loginUser
      tags:
        - 认证
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
                  minLength: 8
                  description: 用户密码
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
                    description: 状态码
                    example: 0
                  message:
                    type: string
                    description: 响应消息
                    example: 登录成功
                  data:
                    type: object
                    properties:
                      access_token:
                        type: string
                        description: 访问令牌 (有效期 1 小时)
                        example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                      refresh_token:
                        type: string
                        description: 刷新令牌 (有效期 7 天)
                        example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                      token_type:
                        type: string
                        description: 令牌类型
                        example: Bearer
                      expires_in:
                        type: integer
                        description: 访问令牌过期时间 (秒)
                        example: 3600
                      user:
                        $ref: '#/components/schemas/User'
        '400':
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
                    message: 密码长度至少 8 位
        '401':
          description: 认证失败
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                wrong_credentials:
                  value:
                    code: 40101
                    message: 邮箱或密码错误
        '429':
          description: 请求过于频繁
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                code: 42901
                message: 请求过于频繁,请稍后再试
        '500':
          description: 服务器内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          description: 用户 ID
          example: "123456789"
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
          description: 用户头像 URL
          example: https://cdn.example.com/avatars/123456789.jpg
        created_at:
          type: string
          format: date-time
          description: 创建时间
          example: "2026-02-13T10:00:00Z"

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
          description: 详细错误信息 (可选)

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Token 认证

security:
  - BearerAuth: []
```

### 3. 接口规范

#### 3.1 请求格式

- **Content-Type**: `application/json`
- **字符编码**: UTF-8
- **请求头**:
  - `Authorization`: Bearer {access_token} (需要认证的接口)
  - `X-Request-ID`: 请求唯一标识 (UUID, 用于追踪)

#### 3.2 响应格式

统一响应格式:

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    // 业务数据
  }
}
```

#### 3.3 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 请求成功但无返回数据 (如删除) |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或认证失败 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 (如重复创建) |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务不可用 |

#### 3.4 业务错误码

错误码采用 5 位数字,格式: `XYZNN`

- **X**: HTTP 状态码首位 (4/5)
- **Y**: HTTP 状态码第二位 (0-9)
- **Z**: HTTP 状态码第三位 (0-9)
- **NN**: 具体业务错误 (01-99)

示例:

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| 40001 | 400 | 邮箱格式不正确 |
| 40002 | 400 | 密码长度不足 |
| 40101 | 401 | 邮箱或密码错误 |
| 40102 | 401 | Token 已过期 |
| 40103 | 401 | Token 无效 |
| 40301 | 403 | 无权限访问会议 |
| 40401 | 404 | 用户不存在 |
| 40402 | 404 | 会议不存在 |
| 40901 | 409 | 邮箱已被注册 |
| 42901 | 429 | 请求过于频繁 |
| 50001 | 500 | 数据库错误 |
| 50002 | 500 | 服务内部错误 |

---

## WebSocket 契约规范

### 1. 连接建立

```
URL: wss://api.meeting.example.com/v1/ws
认证: 连接时携带 Token
参数: ?access_token=<JWT_TOKEN>
```

### 2. 消息格式

所有 WebSocket 消息采用 JSON 格式:

```json
{
  "type": "message_type",
  "seq": 123456,
  "timestamp": 1644739200000,
  "data": {
    // 消息体
  }
}
```

字段说明:
- `type`: 消息类型 (字符串)
- `seq`: 消息序列号 (递增整数, 用于排序和去重)
- `timestamp`: 消息时间戳 (Unix 毫秒)
- `data`: 消息体 (对象)

### 3. 消息类型定义

#### 3.1 客户端发送

| 消息类型 | 说明 | 示例 |
|---------|------|------|
| `join_room` | 加入会议房间 | 见下文 |
| `leave_room` | 离开会议房间 | 见下文 |
| `chat_message` | 发送聊天消息 | 见下文 |
| `media_control` | 音视频控制 | 见下文 |

#### 3.2 服务端推送

| 消息类型 | 说明 | 示例 |
|---------|------|------|
| `user_joined` | 用户加入通知 | 见下文 |
| `user_left` | 用户离开通知 | 见下文 |
| `chat_message` | 聊天消息 | 见下文 |
| `media_state_changed` | 音视频状态变化 | 见下文 |
| `error` | 错误消息 | 见下文 |

### 4. 消息示例

#### 加入会议房间

客户端 → 服务端:

```json
{
  "type": "join_room",
  "seq": 1,
  "timestamp": 1644739200000,
  "data": {
    "room_id": "123456789"
  }
}
```

服务端 → 客户端 (广播):

```json
{
  "type": "user_joined",
  "seq": 100,
  "timestamp": 1644739200001,
  "data": {
    "user": {
      "id": "user123",
      "nickname": "张三",
      "avatar": "https://cdn.example.com/avatars/user123.jpg"
    },
    "room_id": "123456789",
    "participant_count": 3
  }
}
```

#### 发送聊天消息

客户端 → 服务端:

```json
{
  "type": "chat_message",
  "seq": 2,
  "timestamp": 1644739210000,
  "data": {
    "room_id": "123456789",
    "content": "大家好!",
    "content_type": "text"
  }
}
```

服务端 → 客户端 (广播):

```json
{
  "type": "chat_message",
  "seq": 101,
  "timestamp": 1644739210001,
  "data": {
    "message_id": "msg_001",
    "room_id": "123456789",
    "sender": {
      "id": "user123",
      "nickname": "张三"
    },
    "content": "大家好!",
    "content_type": "text",
    "created_at": "2026-02-13T10:00:10Z"
  }
}
```

#### 音视频控制

客户端 → 服务端:

```json
{
  "type": "media_control",
  "seq": 3,
  "timestamp": 1644739220000,
  "data": {
    "room_id": "123456789",
    "action": "mute_audio"
  }
}
```

服务端 → 客户端 (广播):

```json
{
  "type": "media_state_changed",
  "seq": 102,
  "timestamp": 1644739220001,
  "data": {
    "room_id": "123456789",
    "user_id": "user123",
    "audio_muted": true,
    "video_muted": false
  }
}
```

#### 错误消息

服务端 → 客户端:

```json
{
  "type": "error",
  "seq": 103,
  "timestamp": 1644739230000,
  "data": {
    "code": 40401,
    "message": "会议不存在",
    "request_seq": 1
  }
}
```

---

## SDK 接口契约规范

### 1. 接口定义语言

使用各平台原生接口定义语言:

- **iOS**: Swift / Objective-C
- **Android**: Kotlin / Java
- **Windows/macOS/Linux**: C++ Header
- **Web**: TypeScript

### 2. 接口示例 (TypeScript)

```typescript
/**
 * 会议 SDK 主接口
 */
export interface MeetingSDK {
  /**
   * 初始化 SDK
   * @param config SDK 配置
   * @returns Promise<void>
   */
  initialize(config: SDKConfig): Promise<void>;

  /**
   * 创建会议
   * @param options 会议选项
   * @returns Promise<Meeting>
   */
  createMeeting(options: CreateMeetingOptions): Promise<Meeting>;

  /**
   * 加入会议
   * @param roomId 会议号
   * @param options 加入选项
   * @returns Promise<Meeting>
   */
  joinMeeting(roomId: string, options: JoinMeetingOptions): Promise<Meeting>;

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
  /** STUN 服务器地址 */
  stunServers?: string[];
  /** TURN 服务器地址 */
  turnServers?: TURNServer[];
  /** 日志级别 */
  logLevel?: LogLevel;
}

/**
 * 会议接口
 */
export interface Meeting {
  /** 会议号 */
  readonly roomId: string;
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
```

### 3. 错误处理

SDK 使用统一的错误类型:

```typescript
export class MeetingError extends Error {
  /** 错误码 */
  readonly code: number;
  /** 错误消息 */
  readonly message: string;
  /** 详细信息 */
  readonly details?: any;

  constructor(code: number, message: string, details?: any) {
    super(message);
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

## 契约评审流程

### 1. 提交评审

接口契约完成后,发起评审:

1. 创建 Pull Request
2. 在 `docs/versions/v{version}/requirements/{req_id}/api_contract.md` 提交契约
3. 标记相关 Team Leader 为 Reviewer

### 2. 评审检查项

- [ ] 接口定义完整 (请求/响应/错误)
- [ ] 符合 OpenAPI 3.0 规范
- [ ] 错误码定义清晰
- [ ] 数据模型定义完整
- [ ] 示例代码可运行
- [ ] 与需求文档一致
- [ ] 各 Team 确认可实现

### 3. 评审通过

评审通过后:

1. 合并 PR
2. 更新契约状态为 `approved`
3. 各 Team 基于契约开始开发
4. 生成 Mock 数据供前端/客户端使用

### 4. 契约变更

契约变更需重新评审:

1. 创建新版本 (v2)
2. 标记旧版本为 `deprecated`
3. 制定废弃时间表
4. 通知所有相关 Team

---

## Mock 数据生成

### 1. 基于 OpenAPI 生成

使用工具自动生成 Mock Server:

```bash
# 使用 Prism 生成 Mock Server
npx @stoplight/prism-cli mock openapi.yaml
```

### 2. Mock 数据规范

Mock 数据需满足:
- 符合 Schema 定义
- 数据合理真实
- 覆盖正常和异常场景

---

## 契约测试

### 1. 服务端契约测试

使用 Pact 或类似工具进行契约测试:

```javascript
// 示例: 使用 Jest + Pact
describe('Auth API Contract', () => {
  it('should login successfully', async () => {
    const response = await api.post('/auth/login', {
      email: 'user@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(200);
    expect(response.data).toMatchSchema(loginResponseSchema);
  });
});
```

### 2. 客户端契约测试

客户端需验证 SDK 接口符合契约:

```typescript
// 示例: 使用 Jest
describe('MeetingSDK Contract', () => {
  it('should initialize successfully', async () => {
    const sdk = new MeetingSDK();
    await expect(sdk.initialize(config)).resolves.toBeUndefined();
  });

  it('should throw error for invalid config', async () => {
    const sdk = new MeetingSDK();
    await expect(sdk.initialize({})).rejects.toThrow(MeetingError);
  });
});
```

---

## 版本管理

### 1. 版本号规则

使用语义化版本: `v{major}.{minor}.{patch}`

- **major**: 不兼容的 API 变更
- **minor**: 向后兼容的功能新增
- **patch**: 向后兼容的问题修复

### 2. 版本路径

```
/v1/auth/login  # v1 版本
/v2/auth/login  # v2 版本
```

### 3. 废弃策略

1. 提前 3 个月通知废弃
2. 在响应头中标记: `X-API-Deprecated: true`
3. 文档中标记废弃时间
4. 废弃后保留 6 个月再移除

---

## 附录

### A. OpenAPI 工具

- [Swagger Editor](https://editor.swagger.io/): 在线编辑器
- [Stoplight Studio](https://stoplight.io/studio): 可视化设计工具
- [Prism](https://github.com/stoplightio/prism): Mock Server
- [OpenAPI Generator](https://openapi-generator.tech/): 代码生成

### B. WebSocket 工具

- [wscat](https://github.com/websockets/wscat): WebSocket 命令行客户端
- [Postman](https://www.postman.com/): 支持 WebSocket 测试

### C. 参考资料

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [REST API Design Best Practices](https://restfulapi.net/)
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [Contract Testing with Pact](https://docs.pact.io/)

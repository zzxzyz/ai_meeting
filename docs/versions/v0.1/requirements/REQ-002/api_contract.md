# REQ-002 会议管理 API 契约

## 文档信息

- **需求编号**: REQ-002
- **需求名称**: 会议管理
- **文档类型**: API 契约
- **版本**: v1.0
- **创建日期**: 2026-02-25
- **作者**: architect
- **状态**: 已评审通过
- **OpenAPI 版本**: 3.0.0

---

## 概述

本文档定义会议管理相关的 RESTful API 契约及 WebSocket 消息格式，包括：
- 创建会议
- 加入会议
- 查询会议列表
- 查询会议详情
- 结束会议

所有接口遵循 OpenAPI 3.0 规范。**所有接口均需 JWT 鉴权**（复用 REQ-001 认证体系）。

---

## OpenAPI 规范

```yaml
openapi: 3.0.0
info:
  title: AI Meeting - 会议管理 API
  version: 1.0.0
  description: |
    会议管理相关接口，包括创建会议、加入会议、查询列表、结束会议等功能。

    ## 认证方式
    所有接口需在请求头中携带 JWT Access Token：
    ```
    Authorization: Bearer {access_token}
    ```

    ## 错误码规范
    错误码采用 5 位数字格式 XYZNN（与 REQ-001 保持一致）：
    - X: HTTP 状态码首位 (4 或 5)
    - YZ: HTTP 状态码后两位
    - NN: 具体业务错误编号

    示例：40401 = HTTP 404 + 业务错误 01（会议不存在）

servers:
  - url: https://api.meeting.example.com/v1
    description: 生产环境
  - url: https://api-test.meeting.example.com/v1
    description: 测试环境
  - url: http://localhost:3000/v1
    description: 开发环境

tags:
  - name: 会议管理
    description: 会议创建、加入、查询、结束等接口

paths:
  /meetings:
    post:
      tags:
        - 会议管理
      summary: 创建会议
      description: |
        已登录用户创建一场新会议，系统自动生成唯一 9 位数字会议号。
        创建成功后会议状态为 IN_PROGRESS。
      security:
        - BearerAuth: []
      requestBody:
        required: false
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMeetingDto'
            example:
              title: "产品评审会议"
      responses:
        '201':
          description: 会议创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingResponse'
              example:
                code: 0
                message: "success"
                data:
                  id: "550e8400-e29b-41d4-a716-446655440000"
                  meetingNumber: "123456789"
                  title: "产品评审会议"
                  status: "IN_PROGRESS"
                  creatorId: "user-uuid-001"
                  startedAt: "2026-02-25T14:30:00.000Z"
                  participantCount: 1
                  createdAt: "2026-02-25T14:30:00.000Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'

    get:
      tags:
        - 会议管理
      summary: 查询会议列表
      description: |
        查询当前用户相关的会议列表，支持按类型过滤：
        - created：我创建的会议
        - joined：我参加的会议
        按创建时间降序排列，支持分页。
      security:
        - BearerAuth: []
      parameters:
        - name: type
          in: query
          required: false
          description: 过滤类型，不传则返回全部
          schema:
            type: string
            enum: [created, joined]
          example: created
        - name: page
          in: query
          required: false
          description: 页码，从 1 开始
          schema:
            type: integer
            minimum: 1
            default: 1
          example: 1
        - name: pageSize
          in: query
          required: false
          description: 每页条数，最大 50
          schema:
            type: integer
            minimum: 1
            maximum: 50
            default: 10
          example: 10
      responses:
        '200':
          description: 查询成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingListResponse'
              example:
                code: 0
                message: "success"
                data:
                  items:
                    - id: "550e8400-e29b-41d4-a716-446655440000"
                      meetingNumber: "123456789"
                      title: "产品评审会议"
                      status: "IN_PROGRESS"
                      creatorId: "user-uuid-001"
                      startedAt: "2026-02-25T14:30:00.000Z"
                      participantCount: 3
                      createdAt: "2026-02-25T14:30:00.000Z"
                  total: 1
                  page: 1
                  pageSize: 10
        '401':
          $ref: '#/components/responses/Unauthorized'

  /meetings/join:
    post:
      tags:
        - 会议管理
      summary: 加入会议
      description: |
        通过 9 位会议号加入一场进行中的会议。
        若用户已在该会议中，则直接返回会议信息（幂等）。
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/JoinMeetingDto'
            example:
              meetingNumber: "123456789"
      responses:
        '200':
          description: 加入成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingDetailResponse'
              example:
                code: 0
                message: "success"
                data:
                  id: "550e8400-e29b-41d4-a716-446655440000"
                  meetingNumber: "123456789"
                  title: "产品评审会议"
                  status: "IN_PROGRESS"
                  creatorId: "user-uuid-001"
                  startedAt: "2026-02-25T14:30:00.000Z"
                  durationSeconds: 1920
                  participants:
                    - userId: "user-uuid-001"
                      nickname: "张三"
                      isCreator: true
                      joinedAt: "2026-02-25T14:30:00.000Z"
                    - userId: "user-uuid-002"
                      nickname: "李四"
                      isCreator: false
                      joinedAt: "2026-02-25T14:32:00.000Z"
        '400':
          description: 请求参数错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40001
                message: "会议号格式不正确，请输入 9 位数字"
        '404':
          description: 会议不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40401
                message: "会议不存在，请检查会议号是否正确"
        '410':
          description: 会议已结束
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 41001
                message: "该会议已结束，无法加入"
        '401':
          $ref: '#/components/responses/Unauthorized'

  /meetings/{meetingId}:
    get:
      tags:
        - 会议管理
      summary: 查询会议详情
      description: |
        查询指定会议的详细信息，包括参与者列表、开始时间、持续时长等。
        只有会议参与者或创建者可以查询。
      security:
        - BearerAuth: []
      parameters:
        - name: meetingId
          in: path
          required: true
          description: 会议 UUID
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
      responses:
        '200':
          description: 查询成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingDetailResponse'
        '403':
          description: 无权限查询该会议
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40301
                message: "无权限查询该会议"
        '404':
          description: 会议不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40401
                message: "会议不存在"
        '401':
          $ref: '#/components/responses/Unauthorized'

  /meetings/{meetingId}/end:
    post:
      tags:
        - 会议管理
      summary: 结束会议
      description: |
        会议创建者结束指定会议。
        结束后会议状态变为 ENDED，所有参与者通过 WebSocket 收到通知。
        只有会议创建者可以调用此接口。
      security:
        - BearerAuth: []
      parameters:
        - name: meetingId
          in: path
          required: true
          description: 会议 UUID
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
      responses:
        '200':
          description: 会议结束成功
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
                    example: "success"
                  data:
                    type: object
                    properties:
                      meetingId:
                        type: string
                        format: uuid
                      endedAt:
                        type: string
                        format: date-time
                      durationSeconds:
                        type: integer
              example:
                code: 0
                message: "success"
                data:
                  meetingId: "550e8400-e29b-41d4-a716-446655440000"
                  endedAt: "2026-02-25T16:30:00.000Z"
                  durationSeconds: 7200
        '403':
          description: 非会议创建者，无权结束会议
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40302
                message: "只有会议创建者可以结束会议"
        '404':
          description: 会议不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40401
                message: "会议不存在"
        '409':
          description: 会议已结束，不可重复操作
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                code: 40901
                message: "会议已结束"
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    CreateMeetingDto:
      type: object
      properties:
        title:
          type: string
          description: 会议标题，可选，最长 50 字符
          maxLength: 50
          example: "产品评审会议"

    JoinMeetingDto:
      type: object
      required:
        - meetingNumber
      properties:
        meetingNumber:
          type: string
          description: 9 位数字会议号
          pattern: '^\d{9}$'
          example: "123456789"

    MeetingResponse:
      type: object
      properties:
        code:
          type: integer
          example: 0
        message:
          type: string
          example: "success"
        data:
          $ref: '#/components/schemas/Meeting'

    MeetingListResponse:
      type: object
      properties:
        code:
          type: integer
          example: 0
        message:
          type: string
          example: "success"
        data:
          type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/Meeting'
            total:
              type: integer
              description: 总记录数
            page:
              type: integer
            pageSize:
              type: integer

    MeetingDetailResponse:
      type: object
      properties:
        code:
          type: integer
          example: 0
        message:
          type: string
          example: "success"
        data:
          $ref: '#/components/schemas/MeetingDetail'

    Meeting:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: 会议唯一标识
        meetingNumber:
          type: string
          description: 9 位数字会议号
          example: "123456789"
        title:
          type: string
          description: 会议标题
          example: "产品评审会议"
        status:
          type: string
          enum: [WAITING, IN_PROGRESS, ENDED]
          description: 会议状态
        creatorId:
          type: string
          format: uuid
          description: 创建者用户 ID
        startedAt:
          type: string
          format: date-time
          description: 会议开始时间
          nullable: true
        endedAt:
          type: string
          format: date-time
          description: 会议结束时间
          nullable: true
        participantCount:
          type: integer
          description: 当前参与人数
        createdAt:
          type: string
          format: date-time

    MeetingDetail:
      allOf:
        - $ref: '#/components/schemas/Meeting'
        - type: object
          properties:
            durationSeconds:
              type: integer
              description: 持续时长（秒），会议进行中为实时计算值
            participants:
              type: array
              items:
                $ref: '#/components/schemas/Participant'

    Participant:
      type: object
      properties:
        userId:
          type: string
          format: uuid
        nickname:
          type: string
          example: "张三"
        isCreator:
          type: boolean
          description: 是否为会议创建者
        joinedAt:
          type: string
          format: date-time

    ErrorResponse:
      type: object
      properties:
        code:
          type: integer
          description: 业务错误码
        message:
          type: string
          description: 错误描述

  responses:
    Unauthorized:
      description: 未认证或 Token 无效
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            code: 40101
            message: "未认证，请先登录"
    TooManyRequests:
      description: 请求频率超限
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            code: 42901
            message: "请求过于频繁，请稍后重试"
```

---

## WebSocket 消息格式

会议管理模块复用 REQ-001 建立的 WebSocket 连接（鉴权方式相同），在会议相关事件发生时推送消息。

### 连接说明

```
ws://localhost:3000/ws?token={access_token}
```

### 事件：会议结束通知

**触发时机**：创建者调用 `POST /meetings/:meetingId/end` 成功后，服务端向所有在线参与者推送。

**服务端 → 客户端**：

```json
{
  "event": "meeting.ended",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "meetingNumber": "123456789",
    "endedBy": "user-uuid-001",
    "endedAt": "2026-02-25T16:30:00.000Z",
    "durationSeconds": 7200
  }
}
```

### 事件：参与者加入通知

**触发时机**：有新用户成功加入会议时，通知房间内其他参与者。

**服务端 → 客户端**：

```json
{
  "event": "meeting.participant_joined",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "participant": {
      "userId": "user-uuid-003",
      "nickname": "王五",
      "joinedAt": "2026-02-25T14:35:00.000Z"
    }
  }
}
```

---

## 数据模型定义

### Meeting（会议表）

```sql
CREATE TABLE meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number VARCHAR(9) NOT NULL UNIQUE,   -- 9 位唯一数字会议号
  title         VARCHAR(50),                   -- 会议标题，可为空
  status        VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',  -- WAITING | IN_PROGRESS | ENDED
  creator_id    UUID NOT NULL REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meetings_creator_id ON meetings(creator_id);
CREATE INDEX idx_meetings_status     ON meetings(status);
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
```

### MeetingParticipant（会议参与者表）

```sql
CREATE TABLE meeting_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  UNIQUE (meeting_id, user_id)               -- 同一用户在同一会议只有一条记录
);

CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id    ON meeting_participants(user_id);
```

### TypeScript 类型定义

```typescript
export enum MeetingStatus {
  WAITING     = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  ENDED       = 'ENDED',
}

export interface Meeting {
  id:             string;   // UUID
  meetingNumber:  string;   // 9 位数字字符串
  title:          string | null;
  status:         MeetingStatus;
  creatorId:      string;   // UUID
  startedAt:      Date | null;
  endedAt:        Date | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface MeetingParticipant {
  id:         string;   // UUID
  meetingId:  string;   // UUID
  userId:     string;   // UUID
  joinedAt:   Date;
  leftAt:     Date | null;
}
```

---

## 错误码定义

### 会议管理错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `40001` | 400 | 请求参数格式错误（通用） |
| `40002` | 400 | 会议号格式不正确，请输入 9 位数字 |
| `40101` | 401 | 未认证，请先登录（复用 REQ-001） |
| `40102` | 401 | Token 已过期，请刷新（复用 REQ-001） |
| `40301` | 403 | 无权限查询该会议 |
| `40302` | 403 | 只有会议创建者可以结束会议 |
| `40401` | 404 | 会议不存在，请检查会议号是否正确 |
| `40901` | 409 | 会议已结束，无法重复操作 |
| `41001` | 410 | 该会议已结束，无法加入 |
| `42901` | 429 | 请求频率超限，请稍后重试 |
| `50001` | 500 | 服务器内部错误 |

---

## 鉴权说明

本模块完全复用 REQ-001 的 JWT 认证体系：

- **Access Token 有效期**：1 小时
- **Refresh Token 有效期**：7 天
- **请求头格式**：`Authorization: Bearer {access_token}`
- **Token 刷新**：前端在收到 `401 40102` 时自动调用 `POST /auth/refresh`

所有会议接口均需携带有效的 Access Token，未鉴权请求一律返回 `401`。

---

## 接口限流

| 接口 | 限流规则 |
|------|---------|
| `POST /meetings` | 10 次 / 分钟 / 用户 |
| `POST /meetings/join` | 20 次 / 分钟 / 用户 |
| `GET /meetings` | 60 次 / 分钟 / 用户 |
| `GET /meetings/:id` | 60 次 / 分钟 / 用户 |
| `POST /meetings/:id/end` | 5 次 / 分钟 / 用户 |

---

## 跨 Team 依赖

| 依赖方 | 依赖内容 |
|--------|---------|
| 前端 Team | 使用上述 RESTful API 实现会议管理页面 |
| 客户端 Team | 复用前端逻辑，Electron 端直接调用相同 API |
| 测试 Team | 基于此契约编写接口测试用例 |
| REQ-003 音视频 | 依赖 meetingId 进入音视频房间，依赖 meeting.ended 事件退出 |

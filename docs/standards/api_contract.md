# API 接口契约规范

## 1. 总体原则

### 1.1 设计原则
- **一致性**：统一的命名、错误处理、响应格式
- **可预测性**：符合 RESTful 规范,易于理解
- **向后兼容**：新版本不破坏旧客户端
- **文档完善**：OpenAPI 3.0 规范,自动生成文档

### 1.2 版本管理
- **URL 版本控制**：`/api/v1/...`、`/api/v2/...`
- **版本生命周期**：
  - v1 (稳定) → v2 (新功能) → v1 废弃 (6 个月过渡期) → v1 移除
- **版本公告**：通过 API 响应头、文档和邮件通知

---

## 2. RESTful API 设计

### 2.1 资源命名

**规则**：
- 使用名词复数：`/users`、`/meetings`
- 使用中划线分隔：`/meeting-invitations`
- 避免动词：`POST /meetings`（不是 `/createMeeting`）
- 层级关系：`/users/{userId}/meetings`

**示例**：
```
GET    /api/v1/meetings           # 获取会议列表
POST   /api/v1/meetings           # 创建会议
GET    /api/v1/meetings/{id}      # 获取会议详情
PUT    /api/v1/meetings/{id}      # 更新会议
DELETE /api/v1/meetings/{id}      # 删除会议
POST   /api/v1/meetings/{id}/join # 加入会议
```

---

### 2.2 HTTP 方法语义

| 方法 | 语义 | 幂等性 | 示例 |
|-----|------|--------|------|
| **GET** | 查询资源 | 是 | `GET /users/123` |
| **POST** | 创建资源 | 否 | `POST /meetings` |
| **PUT** | 完整更新 | 是 | `PUT /meetings/123` |
| **PATCH** | 部分更新 | 否 | `PATCH /users/123` |
| **DELETE** | 删除资源 | 是 | `DELETE /meetings/123` |

---

### 2.3 查询参数

**分页**：
```
GET /api/v1/meetings?page=1&pageSize=20

响应：
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**排序**：
```
GET /api/v1/meetings?sort=startTime&order=desc
```

**过滤**：
```
GET /api/v1/meetings?status=active&hostId=123
```

**字段选择**：
```
GET /api/v1/meetings?fields=id,title,startTime
```

---

### 2.4 请求格式

**Content-Type**：
```
Content-Type: application/json
```

**请求体示例**：
```json
POST /api/v1/meetings

{
  "title": "技术评审会议",
  "startTime": "2024-01-01T10:00:00Z",
  "endTime": "2024-01-01T11:00:00Z",
  "participants": [
    "user-123",
    "user-456"
  ],
  "settings": {
    "enableWaitingRoom": true,
    "allowRecording": true
  }
}
```

---

### 2.5 响应格式

**统一响应结构**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 业务数据
  },
  "timestamp": 1678886400
}
```

**成功响应示例**：
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": 200,
  "message": "success",
  "data": {
    "id": "meeting-123",
    "title": "技术评审会议",
    "hostId": "user-789",
    "startTime": "2024-01-01T10:00:00Z",
    "status": "scheduled",
    "joinUrl": "https://meet.example.com/meeting-123"
  },
  "timestamp": 1678886400
}
```

**错误响应示例**：
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "code": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "startTime",
      "message": "Start time must be in the future"
    },
    {
      "field": "title",
      "message": "Title is required"
    }
  ],
  "timestamp": 1678886400
}
```

---

## 3. 错误码设计

### 3.1 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|-------|------|---------|
| **200** | 成功 | 请求成功 |
| **201** | 创建成功 | POST 创建资源 |
| **204** | 无内容 | DELETE 成功 |
| **400** | 请求错误 | 参数验证失败 |
| **401** | 未认证 | Token 无效或过期 |
| **403** | 无权限 | 越权访问 |
| **404** | 资源不存在 | ID 不存在 |
| **409** | 冲突 | 资源已存在 |
| **422** | 无法处理 | 业务逻辑错误 |
| **429** | 请求过于频繁 | 触发限流 |
| **500** | 服务器错误 | 内部错误 |
| **503** | 服务不可用 | 维护中 |

### 3.2 业务错误码

**格式**：`模块(2位) + 错误类型(2位) + 序号(2位)`

**示例**：
```
10-01-01: 用户模块 - 认证错误 - 密码错误
10-01-02: 用户模块 - 认证错误 - Token 过期
10-02-01: 用户模块 - 资源错误 - 用户不存在

20-01-01: 会议模块 - 业务错误 - 会议已满
20-01-02: 会议模块 - 业务错误 - 会议已结束
20-02-01: 会议模块 - 权限错误 - 非主持人无权操作
```

**完整错误码表**：
| 错误码 | 说明 | HTTP 状态码 |
|--------|------|------------|
| 100101 | 密码错误 | 401 |
| 100102 | Token 过期 | 401 |
| 100103 | Token 无效 | 401 |
| 100201 | 用户不存在 | 404 |
| 100202 | 用户已存在 | 409 |
| 100301 | 权限不足 | 403 |
| 200101 | 会议已满 | 422 |
| 200102 | 会议已结束 | 422 |
| 200103 | 会议时间冲突 | 422 |
| 200201 | 会议不存在 | 404 |
| 200301 | 非主持人无权操作 | 403 |

---

## 4. 认证与授权

### 4.1 认证方式

**JWT Bearer Token**：
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token 响应**：
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 4.2 权限检查

**请求头**：
```
X-Permission: meeting:manage
```

**响应**（无权限）：
```json
HTTP/1.1 403 Forbidden

{
  "code": 403,
  "message": "Insufficient permissions",
  "requiredPermission": "meeting:manage"
}
```

---

## 5. API 文档规范

### 5.1 OpenAPI 3.0 规范

```yaml
openapi: 3.0.0
info:
  title: Open Meeting API
  version: 1.0.0
  description: 开源视频会议系统 API

servers:
  - url: https://api.openmeeting.dev/v1
    description: 生产环境
  - url: https://api-staging.openmeeting.dev/v1
    description: 测试环境

paths:
  /meetings:
    get:
      summary: 获取会议列表
      tags:
        - Meeting
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingListResponse'

    post:
      summary: 创建会议
      tags:
        - Meeting
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMeetingRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeetingResponse'

  /meetings/{id}:
    get:
      summary: 获取会议详情
      tags:
        - Meeting
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
        '404':
          description: 会议不存在

components:
  schemas:
    Meeting:
      type: object
      properties:
        id:
          type: string
          example: "meeting-123"
        title:
          type: string
          example: "技术评审会议"
        hostId:
          type: string
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        status:
          type: string
          enum: [scheduled, in_progress, ended]
        participants:
          type: array
          items:
            $ref: '#/components/schemas/Participant'

    CreateMeetingRequest:
      type: object
      required:
        - title
        - startTime
        - endTime
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 100
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        participants:
          type: array
          items:
            type: string

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []
```

### 5.2 文档工具

**Swagger UI**：自动生成交互式文档
```
https://api.openmeeting.dev/docs
```

**Redoc**：美观的静态文档
```
https://api.openmeeting.dev/redoc
```

---

## 6. 版本变更管理

### 6.1 变更类型

**非破坏性变更**（同版本）：
- 新增可选字段
- 新增端点
- 响应中新增字段
- 错误码新增

**破坏性变更**（新版本）：
- 修改/删除必填字段
- 修改响应结构
- 修改错误码含义
- 删除端点

### 6.2 废弃流程

**第 1 阶段：标记废弃**（发布新版本时）
```yaml
/api/v1/old-endpoint:
  deprecated: true
  x-deprecation:
    sunset: "2024-12-31"
    replacement: "/api/v2/new-endpoint"
    message: "此端点将于 2024-12-31 废弃，请迁移到 v2"
```

**响应头提示**：
```
Deprecation: true
Sunset: Sat, 31 Dec 2024 23:59:59 GMT
Link: </api/v2/new-endpoint>; rel="successor-version"
```

**第 2 阶段：过渡期**（6 个月）
- 同时支持新旧版本
- 文档标记"已废弃"
- 邮件通知客户端开发者

**第 3 阶段：移除**（过渡期结束后）
- 移除旧端点
- 返回 410 Gone
```json
HTTP/1.1 410 Gone

{
  "code": 410,
  "message": "This endpoint has been removed. Please use /api/v2/new-endpoint",
  "deprecatedSince": "2024-06-01",
  "removedOn": "2024-12-31"
}
```

---

## 7. 测试规范

### 7.1 契约测试

**工具**：Pact

**Provider 测试**（服务端）：
```typescript
describe('Meeting API Contract', () => {
  it('should return meeting list', async () => {
    const response = await request(app)
      .get('/api/v1/meetings')
      .expect(200);

    expect(response.body).toMatchSchema({
      type: 'object',
      properties: {
        code: { type: 'number' },
        data: {
          type: 'array',
          items: { $ref: '#/schemas/Meeting' }
        }
      }
    });
  });
});
```

**Consumer 测试**（客户端）：
```typescript
import { Pact } from '@pact-foundation/pact';

const provider = new Pact({
  consumer: 'WebApp',
  provider: 'MeetingAPI'
});

describe('Meeting API', () => {
  it('should fetch meetings', async () => {
    await provider.addInteraction({
      state: 'meetings exist',
      uponReceiving: 'a request for meetings',
      withRequest: {
        method: 'GET',
        path: '/api/v1/meetings'
      },
      willRespondWith: {
        status: 200,
        body: {
          code: 200,
          data: Matchers.eachLike({
            id: Matchers.uuid(),
            title: Matchers.string()
          })
        }
      }
    });

    const meetings = await meetingService.fetchMeetings();
    expect(meetings).toBeDefined();
  });
});
```

---

## 8. 参考资料

- [RESTful API 设计指南](https://restfulapi.net/)
- [OpenAPI 3.0 规范](https://swagger.io/specification/)
- [HTTP 状态码](https://httpstatuses.com/)
- [API 设计最佳实践](https://www.microsoft.com/en-us/microsoft-365/blog/2016/06/07/web-api-design-best-practices/)

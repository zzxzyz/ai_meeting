# API 契约评审会议议程

## 会议信息

- **会议名称**: MVP v0.1 API 契约评审会议
- **会议时间**: Week 1 周三（建议 14:00-16:00，2小时）
- **会议地点**: 线上会议室
- **组织者**: Product Manager
- **记录人**: 待定

## 参会人员

### 必须参加（Required）

| 角色 | 姓名 | 职责 |
|------|------|------|
| 产品经理 | Product Manager | 主持会议、需求澄清 |
| 架构师 | Architect | 技术方案评审 |
| 前端 Leader | Frontend Lead | Web 端接口确认 |
| 后端 Leader | Backend Lead | API 设计评审 |
| 客户端 Leader | Client Lead | SDK 接口确认 |
| 测试 Leader | Test Lead | 测试策略确认 |

### 可选参加（Optional）

| 角色 | 姓名 | 职责 |
|------|------|------|
| 运维 Leader | DevOps Lead | 部署相关问题咨询 |

## 会议目标

1. ✅ 评审并通过 MVP v0.1 核心 API 契约
2. ✅ 明确各 Team 的接口实现边界
3. ✅ 确定 Mock 数据生成方案
4. ✅ 制定接口契约变更流程
5. ✅ 安排后续开发时间表

## 会前准备（All Attendees）

### 所有参会人员

- [ ] **提前阅读**：API 契约初稿（本次会议将评审的文档）
- [ ] **提前阅读**：`docs/api/contract_template.md` - API 契约模板规范
- [ ] **提前阅读**：`docs/versions/v0.1/requirements.md` - MVP 需求列表
- [ ] **准备问题清单**：针对接口设计的疑问和建议

### 架构师（Architect）

- [ ] 检查 API 设计是否符合架构规范
- [ ] 准备安全性、性能、可扩展性方面的审核意见

### 后端 Leader（Backend Lead）

- [ ] 评估 API 实现难度和时间
- [ ] 准备数据库设计方案
- [ ] 准备错误码定义

### 前端 Leader（Frontend Lead）

- [ ] 检查 API 是否满足前端需求
- [ ] 准备 Mock 数据需求清单

### 客户端 Leader（Client Lead）

- [ ] 检查 API 是否满足各平台需求
- [ ] 准备 SDK 封装方案

### 测试 Leader（Test Lead）

- [ ] 准备契约测试方案
- [ ] 准备测试用例设计思路

## 会议议程

### Part 1: 开场与背景介绍（14:00-14:10，10分钟）

**主讲人**: Product Manager

- [ ] 会议目标和流程说明
- [ ] MVP v0.1 需求回顾（重点强调 API 相关需求）
- [ ] 契约评审规范说明

### Part 2: 用户认证 API 评审（14:10-14:30，20分钟）

**对应需求**: REQ-001 用户认证系统（P0）

**评审内容**:

#### 2.1 RESTful API（15分钟）

- [ ] **注册接口** (`POST /api/v1/auth/register`)
  - 请求参数：email, password, nickname
  - 响应数据：user, tokens
  - 错误处理：邮箱已注册、密码强度不足

- [ ] **登录接口** (`POST /api/v1/auth/login`)
  - 请求参数：email, password
  - 响应数据：access_token, refresh_token, user
  - 错误处理：认证失败、账号锁定

- [ ] **Token 刷新** (`POST /api/v1/auth/refresh`)
  - 请求参数：refresh_token
  - 响应数据：新的 access_token

- [ ] **登出接口** (`POST /api/v1/auth/logout`)
  - 请求参数：access_token
  - 响应：成功/失败

- [ ] **用户信息查询** (`GET /api/v1/users/me`)
  - 响应数据：user 对象

#### 2.2 数据模型（5分钟）

- [ ] **User 对象**定义
  - id, email, nickname, avatar, created_at, updated_at

- [ ] **Token 响应**定义
  - access_token, refresh_token, token_type, expires_in

#### 2.3 讨论要点

- Token 有效期设置（Access: 1小时，Refresh: 7天）
- 密码加密方式（bcrypt）
- API 限流策略（登录：5次/分钟）
- 错误码范围分配（40001-40099）

**输出**: ✅ 认证 API 契约通过 / ⏸️ 需要修改

---

### Part 3: 会议管理 API 评审（14:30-14:50，20分钟）

**对应需求**: REQ-002 会议管理（P0）

**评审内容**:

#### 3.1 RESTful API（15分钟）

- [ ] **创建会议** (`POST /api/v1/meetings`)
  - 请求参数：title (optional)
  - 响应数据：meeting 对象（包含 meeting_number）

- [ ] **加入会议** (`POST /api/v1/meetings/{meeting_number}/join`)
  - 路径参数：meeting_number
  - 响应数据：meeting 详情、参与者列表

- [ ] **会议列表** (`GET /api/v1/meetings`)
  - 查询参数：type (my/history), page, limit
  - 响应数据：meetings 数组、分页信息

- [ ] **会议详情** (`GET /api/v1/meetings/{meeting_id}`)
  - 响应数据：meeting 对象、参与者列表

- [ ] **结束会议** (`POST /api/v1/meetings/{meeting_id}/end`)
  - 权限：仅创建者
  - 响应：成功/失败

#### 3.2 数据模型（5分钟）

- [ ] **Meeting 对象**定义
  - id, meeting_number, title, creator_id, status, started_at, ended_at

- [ ] **Participant 对象**定义
  - user_id, nickname, avatar, joined_at, audio_muted, video_muted

#### 3.3 讨论要点

- 会议号生成规则（9位数字）
- 会议状态枚举（waiting/active/ended）
- 会议号有效期（创建后24小时）
- 错误码范围（40402：会议不存在）

**输出**: ✅ 会议管理 API 契约通过 / ⏸️ 需要修改

---

### Part 4: WebSocket 信令 API 评审（14:50-15:20，30分钟）

**对应需求**: REQ-003 音视频通话（P0）, REQ-006 文字聊天（P1）

**评审内容**:

#### 4.1 连接建立（5分钟）

- [ ] WebSocket URL 格式：`wss://api.meeting.example.com/v1/ws?access_token={token}`
- [ ] 连接认证方式
- [ ] 心跳机制（ping/pong）
- [ ] 重连策略

#### 4.2 消息格式（5分钟）

- [ ] 统一消息结构：
  ```json
  {
    "type": "message_type",
    "seq": 123,
    "timestamp": 1644739200000,
    "data": {}
  }
  ```
- [ ] 序列号（seq）生成规则
- [ ] 时间戳格式

#### 4.3 信令消息（15分钟）

**客户端 → 服务端**:
- [ ] `join_room` - 加入会议房间
- [ ] `leave_room` - 离开会议房间
- [ ] `media_control` - 音视频控制（mute_audio/mute_video）
- [ ] `chat_message` - 发送聊天消息

**服务端 → 客户端**:
- [ ] `user_joined` - 用户加入通知
- [ ] `user_left` - 用户离开通知
- [ ] `media_state_changed` - 音视频状态变化
- [ ] `chat_message` - 聊天消息广播
- [ ] `error` - 错误消息

#### 4.4 讨论要点

- 消息去重机制（基于 seq）
- 消息顺序保证
- 断线重连后的消息同步
- 错误消息格式统一

**输出**: ✅ WebSocket API 契约通过 / ⏸️ 需要修改

---

### Part 5: SDK 接口评审（15:20-15:40，20分钟）

**对应需求**: 所有客户端相关需求

**评审内容**:

#### 5.1 SDK 初始化接口（5分钟）

- [ ] TypeScript 接口定义
  ```typescript
  interface MeetingSDK {
    initialize(config: SDKConfig): Promise<void>;
    destroy(): Promise<void>;
  }
  ```
- [ ] 配置参数：apiServer, wsServer, stunServers, turnServers

#### 5.2 会议操作接口（10分钟）

- [ ] `createMeeting(options): Promise<Meeting>`
- [ ] `joinMeeting(roomId, options): Promise<Meeting>`
- [ ] `getDevices(): Promise<MediaDevices>`

#### 5.3 Meeting 对象接口（5分钟）

- [ ] `leave(): Promise<void>`
- [ ] `muteAudio(muted: boolean): Promise<void>`
- [ ] `muteVideo(muted: boolean): Promise<void>`
- [ ] `sendChatMessage(content: string): Promise<void>`
- [ ] 事件监听：`on(event, handler)`, `off(event, handler)`

#### 5.4 讨论要点

- 各平台 SDK 接口一致性（TypeScript/Swift/Kotlin/C++）
- 错误处理方式（Promise reject vs 回调）
- 事件命名约定
- 平台差异处理

**输出**: ✅ SDK 接口契约通过 / ⏸️ 需要修改

---

### Part 6: 数据模型与错误码统一（15:40-15:50，10分钟）

**主讲人**: Architect

**评审内容**:

#### 6.1 通用数据模型（5分钟）

- [ ] **User**: id, email, nickname, avatar, created_at
- [ ] **Meeting**: id, meeting_number, title, creator_id, status, timestamps
- [ ] **Participant**: user_id, nickname, avatar, joined_at, media_states
- [ ] **Message**: id, room_id, sender, content, created_at

#### 6.2 错误码体系（5分钟）

- [ ] 错误码格式：XYZNN（X=HTTP首位，YZ=HTTP后两位，NN=业务错误）
- [ ] 错误码分配：
  - 40001-40099: 参数错误
  - 40101-40199: 认证错误
  - 40301-40399: 权限错误
  - 40401-40499: 资源不存在
  - 40901-40999: 资源冲突
  - 50001-50099: 服务器错误

**输出**: ✅ 数据模型和错误码通过 / ⏸️ 需要修改

---

### Part 7: Mock 数据与并行开发（15:50-16:00，10分钟）

**主讲人**: Backend Lead

**讨论内容**:

- [ ] Mock Server 搭建方案（Prism + OpenAPI）
- [ ] Mock 数据生成规则
- [ ] 前端/客户端如何使用 Mock 数据
- [ ] Mock 数据更新流程
- [ ] 契约测试方案（Pact）

**输出**: ✅ Mock 方案确定

---

### Part 8: 总结与后续安排（16:00-16:10，10分钟）

**主讲人**: Product Manager

- [ ] 会议决议总结
- [ ] 需修改的契约项汇总
- [ ] 后续任务分配：
  - 后端 Leader: 更新 API 契约文档，搭建 Mock Server
  - 前端 Leader: 基于契约开始前端开发
  - 客户端 Leader: 基于契约开始 SDK 封装
  - 测试 Leader: 编写契约测试用例
  - 架构师: 更新架构文档

- [ ] 契约变更流程说明
- [ ] 下次评审时间确定（如有需要）

---

## 会议决议模板

### 评审结果

| 契约类型 | 状态 | 备注 |
|---------|------|------|
| 用户认证 API | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |
| 会议管理 API | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |
| WebSocket 信令 | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |
| SDK 接口 | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |
| 数据模型 | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |
| 错误码体系 | ✅ 通过 / ⏸️ 需修改 / ❌ 驳回 | |

### 待办事项

| 任务 | 负责人 | 截止日期 | 优先级 |
|------|--------|---------|--------|
| 更新 API 契约文档 | Backend Lead | Week 1 Day 5 | P0 |
| 搭建 Mock Server | Backend Lead | Week 1 Day 5 | P0 |
| 生成 OpenAPI 文档 | Backend Lead | Week 1 Day 5 | P0 |
| 前端基于契约开发 | Frontend Lead | Week 2 开始 | P0 |
| SDK 接口封装 | Client Lead | Week 2 开始 | P0 |
| 契约测试用例编写 | Test Lead | Week 2 | P0 |

### 遗留问题

| 问题 | 负责人 | 跟进计划 |
|------|--------|---------|
| （会议中记录） | | |

---

## 会后跟进

### 会议纪要发布

- [ ] **记录人**：整理会议纪要
- [ ] **记录人**：24小时内发送给所有参会人员
- [ ] **所有人**：48小时内反馈意见

### 契约文档更新

- [ ] **后端 Leader**：根据评审意见更新契约文档
- [ ] **后端 Leader**：提交 Pull Request
- [ ] **架构师**：Review 并 Approve
- [ ] **产品经理**：合并 PR，标记契约状态为 `approved`

### Mock Server 搭建

- [ ] **后端 Leader**：部署 Prism Mock Server
- [ ] **后端 Leader**：提供 Mock Server URL 给前端和客户端团队
- [ ] **前端/客户端 Leader**：验证 Mock 数据可用性

### 开发启动

- [ ] **所有 Team Leader**：组织团队开始基于契约的并行开发
- [ ] **测试 Leader**：开始编写契约测试用例

---

## 附录

### A. 相关文档链接

- [API 契约模板](../../../api/contract_template.md)
- [MVP 需求列表](../v0.1/requirements.md)
- [v0.1 版本规划](../v0.1/plan.md)
- [系统架构设计](../../architecture/system.md)

### B. 会议资料

- [API 契约初稿](./api-contract-draft.md)（本次评审文档）
- [OpenAPI 规范参考](https://spec.openapis.org/oas/latest.html)

### C. 工具链接

- [Swagger Editor](https://editor.swagger.io/)
- [Stoplight Studio](https://stoplight.io/studio)
- [Prism Mock Server](https://github.com/stoplightio/prism)

---

**文档版本**: v1.0
**创建日期**: 2026-02-14
**更新日期**: 2026-02-14
**创建人**: AI Agent Team

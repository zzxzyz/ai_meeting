# 任务创建标准规范

## 目的

本文档定义了 Agent Team 协作中创建任务的标准格式和规范,确保任务描述清晰、角色分配准确、执行高效。

---

## 一、任务命名规范 (Subject)

### 1.1 标准格式

```
[角色名] 任务简述
```

### 1.2 角色名称枚举

使用以下标准角色名称之一:

| 角色名 | 职责范围 | 示例 |
|--------|---------|------|
| `team-lead` | 团队协调、任务分配、进度监控 | `[team-lead] 创建 REQ-002 开发计划` |
| `product-manager` | 需求分析、PRD 编写、UI/UX 设计评审 | `[product-manager] REQ-002 需求分析` |
| `architect` | 架构设计、技术调研、ADR 编写 | `[architect] REQ-002 技术方案设计` |
| `backend-leader` | 后端实现、API 开发、数据库设计 | `[backend-leader] REQ-002 后端实现` |
| `frontend-leader` | 前端实现、Web 端开发、组件开发 | `[frontend-leader] REQ-002 前端实现` |
| `client-leader` | 客户端实现、SDK 开发、跨平台适配 | `[client-leader] REQ-002 Electron 实现` |
| `test-leader` | 测试设计、测试执行、质量把控 | `[test-leader] REQ-002 集成测试` |
| `devops-leader` | 部署配置、CI/CD、监控告警 | `[devops-leader] REQ-002 部署配置` |

### 1.3 任务简述规范

- **长度**: 5-15 个汉字
- **形式**: 动宾结构 (动词 + 名词)
- **内容**: 清楚表达任务的核心目标

**好的示例**:
- ✅ `[backend-leader] REQ-002 后端实现 - 会议管理服务`
- ✅ `[frontend-leader] 实现会议列表页面`
- ✅ `[test-leader] 编写端到端测试用例`

**不好的示例**:
- ❌ `后端开发` (缺少角色标识,不清楚具体做什么)
- ❌ `[backend-leader] 完成 REQ-002 的所有后端相关工作包括 API、数据库、服务层等` (太长)
- ❌ `[architect] 技术` (太简略)

---

## 二、任务描述规范 (Description)

### 2.1 标准模板

````markdown
⚠️ **本任务仅限 [角色名] 领取**

**任务目标**:
[一句话描述任务的最终目标和价值]

**具体工作**:
1. [工作项 1]
2. [工作项 2]
3. [工作项 3]
...

**参考文档**:
- [文档名称](`路径/文件名.md`)
- [文档名称](`路径/文件名.md`)

**交付物**:
- [交付物 1]: `路径/文件名.ext`
- [交付物 2]: `路径/文件名.ext`
...

**优先级**: [HIGH/MEDIUM/LOW]

**依赖**: [如有依赖,说明依赖的任务 ID 或条件]

**备注**: [其他重要说明]
````

### 2.2 各字段说明

#### ⚠️ 角色限制声明 (必填)

**目的**: 明确警示,防止跨角色领取

**格式**:
```markdown
⚠️ **本任务仅限 [角色名] 领取**
```

**示例**:
- `⚠️ **本任务仅限 backend-leader 领取**`
- `⚠️ **本任务仅限 frontend-leader 领取**`

**备注**: 使用警告符号 (⚠️) 和加粗格式,确保醒目

#### 任务目标 (必填)

**目的**: 让执行者清楚理解任务的价值和最终结果

**格式**: 一句话,说明"为什么做"和"要达到什么效果"

**示例**:
- ✅ `实现完整的会议管理后端服务,包括创建、加入、离开、结束会议的 API`
- ✅ `设计并实现会议列表页面,支持筛选、排序、分页功能`
- ❌ `写代码` (太模糊)
- ❌ `按照需求文档做` (没有说明目标)

#### 具体工作 (必填)

**目的**: 分解任务,列出可执行的步骤

**格式**: 有序列表,每项一个可独立执行的工作

**要求**:
- 每项工作清晰明确
- 按执行顺序排列
- 3-10 项为宜 (太少说明不清晰,太多说明任务过大需拆分)

**示例**:
```markdown
**具体工作**:
1. 创建 DTO 类 (CreateMeetingDto, JoinMeetingDto, MeetingResponseDto)
2. 实现 MeetingController (POST /meetings, POST /meetings/:id/join, DELETE /meetings/:id/leave)
3. 实现 MeetingService 业务逻辑 (会议创建、加入、离开、结束)
4. 实现 MeetingRepository 数据访问层
5. 集成 WebSocket 推送 (会议状态变更通知)
6. 编写单元测试 (覆盖率 > 90%)
7. 更新 API 文档
```

#### 参考文档 (可选,但强烈推荐)

**目的**: 提供上下文,帮助执行者快速了解背景

**格式**: 列表,包含文档名称和路径

**示例**:
```markdown
**参考文档**:
- 需求分析: `docs/versions/v0.1/requirements/REQ-002/analysis.md`
- 技术调研: `docs/versions/v0.1/requirements/REQ-002/tech_research.md`
- API 契约: `docs/versions/v0.1/requirements/REQ-002/api_contract.md`
- 现有代码结构: `apps/backend/src/api/controllers/`
```

#### 交付物 (必填)

**目的**: 明确任务的产出,便于验收

**格式**: 列表,包含交付物名称和路径

**要求**:
- 使用绝对路径或相对于项目根目录的路径
- 如果是多个文件,可以使用通配符或目录路径

**示例**:
```markdown
**交付物**:
- 控制器: `apps/backend/src/api/controllers/meeting/meeting.controller.ts`
- 服务: `apps/backend/src/application/services/meeting.service.ts`
- 仓储: `apps/backend/src/infrastructure/database/repositories/meeting.repository.ts`
- DTO: `apps/backend/src/api/dto/meeting.dto.ts`
- 单元测试: `tests/unit/backend/meeting/*.spec.ts`
- API 文档: `docs/versions/v0.1/requirements/REQ-002/api_contract.md` (更新)
```

#### 优先级 (可选)

**目的**: 帮助执行者和 team-lead 判断任务的紧急程度

**格式**: `HIGH` / `MEDIUM` / `LOW`

**判断标准**:
- `HIGH`: 阻塞其他任务,必须优先完成
- `MEDIUM`: 重要但不紧急,按计划完成即可
- `LOW`: 可以延后,不影响整体进度

**示例**:
```markdown
**优先级**: HIGH
```

#### 依赖 (可选)

**目的**: 说明任务的前置条件,避免过早启动

**格式**: 自然语言描述或任务 ID 引用

**示例**:
```markdown
**依赖**: 需要 Task #3 (API 契约设计) 完成后才能开始
```

```markdown
**依赖**: 需要 architect 完成技术调研并确定使用 Socket.IO
```

#### 备注 (可选)

**目的**: 补充其他重要信息

**示例**:
```markdown
**备注**: 此任务为中期规划,不影响 REQ-002 开发
```

```markdown
**备注**: 如遇到技术难点,请及时与 architect 沟通
```

---

## 三、ActiveForm 规范

### 3.1 定义

`activeForm` 是任务处于 `in_progress` 状态时,在 UI 中显示的进行时态描述。

### 3.2 标准格式

- **时态**: 现在进行时 (动词 + "ing" 形式的汉语表达)
- **长度**: 3-8 个汉字
- **内容**: 与 subject 对应,但使用进行时态

### 3.3 对应关系

| Subject (主题) | ActiveForm (进行时) |
|---------------|-------------------|
| REQ-002 需求分析 | 分析 REQ-002 需求 |
| REQ-002 后端实现 | 实现后端服务 |
| 编写单元测试 | 编写测试用例 |
| 设计 API 契约 | 设计 API 接口 |
| 部署到测试环境 | 部署测试环境 |

### 3.4 示例

```javascript
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现",
  description: "...",
  activeForm: "实现后端服务"  // ✅ 进行时态
})
```

**不好的示例**:
- ❌ `activeForm: "REQ-002 后端实现"` (与 subject 重复,不是进行时)
- ❌ `activeForm: "完成后端开发"` ("完成" 是结果导向,不是进行时)

---

## 四、完整示例

### 示例 1: 后端实现任务

```javascript
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现 - 会议管理服务",
  description: `⚠️ **本任务仅限 backend-leader 领取**

**任务目标**:
实现完整的会议管理后端服务,包括创建、加入、离开、结束会议的 API,支持会议状态推送。

**具体工作**:
1. 创建 DTO 类 (CreateMeetingDto, JoinMeetingDto, MeetingResponseDto)
2. 实现 MeetingController (POST /meetings, POST /meetings/:id/join, DELETE /meetings/:id/leave, POST /meetings/:id/end)
3. 实现 MeetingService 业务逻辑:
   - 会议创建 (生成会议ID、验证用户权限)
   - 会议加入 (验证会议状态、更新参与者列表)
   - 会议离开 (更新参与者列表、检查是否需要结束会议)
   - 会议结束 (仅主持人可操作、通知所有参与者)
4. 实现 MeetingRepository 数据访问层
5. 集成 Socket.IO 推送 (会议状态变更通知)
6. 实现 JWT 守卫保护所有 API
7. 编写单元测试 (覆盖率 > 90%)
8. 更新 API 文档

**参考文档**:
- 需求分析: \`docs/versions/v0.1/requirements/REQ-002/analysis.md\`
- 技术调研: \`docs/versions/v0.1/requirements/REQ-002/tech_research.md\`
- API 契约: \`docs/versions/v0.1/requirements/REQ-002/api_contract.md\`
- REQ-001 后端实现: \`apps/backend/src/api/controllers/auth/\` (可复用认证逻辑)

**交付物**:
- \`apps/backend/src/api/dto/meeting.dto.ts\`
- \`apps/backend/src/api/controllers/meeting/meeting.controller.ts\`
- \`apps/backend/src/api/controllers/meeting/meeting.module.ts\`
- \`apps/backend/src/application/services/meeting.service.ts\`
- \`apps/backend/src/infrastructure/database/repositories/meeting.repository.ts\`
- \`apps/backend/src/infrastructure/database/entities/meeting.entity.ts\`
- \`tests/unit/backend/meeting/*.spec.ts\`

**优先级**: HIGH

**依赖**: 需要 Task #3 (API 契约设计) 完成
`,
  activeForm: "实现会议管理服务"
})
```

### 示例 2: 前端实现任务

```javascript
TaskCreate({
  subject: "[frontend-leader] REQ-002 前端实现 - 会议列表页面",
  description: `⚠️ **本任务仅限 frontend-leader 领取**

**任务目标**:
实现会议列表页面,支持创建会议、加入会议、查看会议详情,提供良好的用户体验。

**具体工作**:
1. 创建 MeetingList 组件 (列表展示、筛选、排序、分页)
2. 创建 CreateMeetingModal 组件 (创建会议弹窗)
3. 创建 JoinMeetingModal 组件 (加入会议弹窗)
4. 实现 useMeeting hook (会议列表获取、创建、加入)
5. 实现 meetingStore (Zustand,会议状态管理)
6. 集成 Socket.IO 客户端 (接收会议状态推送)
7. 实现 API 调用封装 (api/meeting.ts)
8. 编写组件测试 (React Testing Library)

**参考文档**:
- UI/UX 设计: \`docs/versions/v0.1/requirements/REQ-002/designs/ui-ux-design.md\`
- API 契约: \`docs/versions/v0.1/requirements/REQ-002/api_contract.md\`
- REQ-001 前端实现: \`apps/web/src/pages/Login.tsx\` (可复用布局和样式)

**交付物**:
- \`apps/web/src/pages/MeetingList.tsx\`
- \`apps/web/src/components/meeting/CreateMeetingModal.tsx\`
- \`apps/web/src/components/meeting/JoinMeetingModal.tsx\`
- \`apps/web/src/components/meeting/MeetingItem.tsx\`
- \`apps/web/src/hooks/useMeeting.ts\`
- \`apps/web/src/stores/meetingStore.ts\`
- \`apps/web/src/api/meeting.ts\`
- \`apps/web/src/__tests__/meeting/*.test.tsx\`

**优先级**: HIGH

**依赖**: 需要 Task #4 (UI/UX 设计) 和 Task #3 (API 契约) 完成
`,
  activeForm: "实现会议列表页面"
})
```

### 示例 3: 测试任务

```javascript
TaskCreate({
  subject: "[test-leader] REQ-002 集成测试 - 会议管理端到端测试",
  description: `⚠️ **本任务仅限 test-leader 领取**

**任务目标**:
编写完整的会议管理端到端测试,覆盖创建会议、加入会议、离开会议、结束会议的完整流程。

**具体工作**:
1. 编写后端集成测试 (tests/integration/meeting.test.ts):
   - 测试会议创建 API
   - 测试会议加入 API
   - 测试会议离开 API
   - 测试会议结束 API
   - 测试权限验证
   - 测试并发场景
2. 编写 E2E 测试 (tests/e2e/web/meeting.spec.ts):
   - 测试完整的会议创建流程
   - 测试加入会议流程
   - 测试会议中离开流程
   - 测试主持人结束会议流程
3. 编写测试报告:
   - 测试用例数
   - 测试覆盖率
   - 发现的问题
   - 测试建议

**参考文档**:
- API 契约: \`docs/versions/v0.1/requirements/REQ-002/api_contract.md\`
- 需求分析: \`docs/versions/v0.1/requirements/REQ-002/analysis.md\`
- REQ-001 测试用例: \`tests/unit/backend/auth/\` (可复用测试模式)

**交付物**:
- \`tests/integration/meeting.test.ts\`
- \`tests/e2e/web/meeting.spec.ts\`
- \`docs/versions/v0.1/requirements/REQ-002/test_report.md\`

**优先级**: HIGH

**依赖**: 需要 Task #5 (后端实现) 和 Task #6 (前端实现) 完成

**备注**: 测试与实施可以并行进行,先编写测试用例框架,再根据实施进度完善测试
`,
  activeForm: "编写端到端测试"
})
```

### 示例 4: 架构设计任务

```javascript
TaskCreate({
  subject: "[architect] REQ-002 技术调研 - WebSocket 推送方案",
  description: `⚠️ **本任务仅限 architect 领取**

**任务目标**:
调研并确定会议状态实时推送的技术方案,对比 Socket.IO、原生 WebSocket、Server-Sent Events 方案。

**具体工作**:
1. 调研 Socket.IO 方案:
   - 客户端库和服务端库
   - 集成方式 (NestJS)
   - 连接管理和房间机制
   - 优缺点分析
2. 调研原生 WebSocket 方案:
   - NestJS WebSocket Gateway
   - 客户端实现
   - 优缺点分析
3. 调研 Server-Sent Events 方案:
   - 实现方式
   - 浏览器兼容性
   - 优缺点分析
4. 方案对比和推荐:
   - 性能对比
   - 开发复杂度对比
   - 维护成本对比
   - 最终推荐方案
5. 设计 WebSocket 消息协议:
   - 消息格式定义
   - 事件类型枚举
   - 错误处理机制

**参考文档**:
- NestJS WebSocket 文档: https://docs.nestjs.com/websockets/gateways
- Socket.IO 文档: https://socket.io/docs/v4/
- 现有后端架构: \`docs/architecture/backend.md\`

**交付物**:
- \`docs/versions/v0.1/requirements/REQ-002/tech_research.md\`

**优先级**: HIGH

**依赖**: 需要完成 REQ-002 需求分析
`,
  activeForm: "调研 WebSocket 方案"
})
```

---

## 五、使用流程

### 5.1 Team-lead 创建任务流程

1. **创建任务** (使用标准格式)
   ```javascript
   TaskCreate({
     subject: "[角色名] 任务简述",
     description: "按照模板填写",
     activeForm: "进行时态描述"
   })
   // 返回: Task #X created
   ```

2. **立即分配 owner** (不等待 agent 自主领取)
   ```javascript
   TaskUpdate(X, { owner: "角色名" })
   ```

3. **发送通知消息**
   ```javascript
   SendMessage({
     type: "message",
     recipient: "角色名",
     content: "已为你分配 Task #X: [任务名称],请开始执行",
     summary: "新任务分配: Task #X"
   })
   ```

### 5.2 Agent 领取任务流程

1. **查看自己的任务**
   ```javascript
   TaskList()
   // 检查 owner 是否为自己的角色名
   ```

2. **标记任务为进行中**
   ```javascript
   TaskUpdate(X, { status: "in_progress" })
   ```

3. **执行任务** (按照 description 中的具体工作)

4. **完成后标记为完成**
   ```javascript
   TaskUpdate(X, { status: "completed" })
   ```

5. **通知 team-lead**
   ```javascript
   SendMessage({
     type: "message",
     recipient: "team-lead",
     content: "Task #X 已完成,交付物已输出到 [路径]",
     summary: "Task #X 完成"
   })
   ```

---

## 六、检查清单

### 6.1 Team-lead 创建任务检查清单

创建任务前,确认以下事项:

- [ ] Subject 使用 `[角色名] 任务简述` 格式
- [ ] Description 包含 `⚠️ **本任务仅限 XXX 领取**` 警告
- [ ] Description 包含任务目标、具体工作、交付物
- [ ] ActiveForm 使用进行时态
- [ ] 任务分解合理 (3-10 项具体工作)
- [ ] 交付物路径明确
- [ ] 参考文档齐全
- [ ] 依赖关系清晰

创建任务后,确认以下事项:

- [ ] 使用 TaskUpdate 立即分配 owner
- [ ] 使用 SendMessage 通知对应 agent
- [ ] 如有依赖,使用 TaskUpdate 设置 blockedBy

### 6.2 Agent 执行任务检查清单

领取任务前,确认以下事项:

- [ ] 任务的 owner 是自己
- [ ] 任务的 subject 中角色名匹配自己
- [ ] 任务的 description 中角色限制匹配自己
- [ ] 任务没有被阻塞 (blockedBy 为空)

执行任务中,确认以下事项:

- [ ] 已标记任务为 in_progress
- [ ] 按照具体工作逐项完成
- [ ] 参考了所有参考文档
- [ ] 遇到问题及时与 team-lead 或相关角色沟通

完成任务后,确认以下事项:

- [ ] 所有交付物已输出
- [ ] 交付物路径与任务描述一致
- [ ] 使用 TaskUpdate 标记任务为 completed
- [ ] 使用 SendMessage 通知 team-lead
- [ ] 检查是否解除了其他任务的阻塞

---

## 七、常见问题

### Q1: 如果任务太大,无法在一个任务中完成怎么办?

**A**: 将任务拆分为多个子任务,每个子任务使用相同的角色标识,并设置依赖关系。

示例:
```javascript
// 父任务
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现 - 会议管理 (第1阶段)",
  description: "实现基础 CRUD API",
  ...
})  // Task #5

// 子任务
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现 - 会议管理 (第2阶段)",
  description: "实现 WebSocket 推送",
  ...
})  // Task #6

TaskUpdate(6, { addBlockedBy: ["5"] })  // Task #6 依赖 Task #5
```

### Q2: 如果任务需要多个角色协作怎么办?

**A**: 按角色拆分任务,每个角色一个任务,通过依赖关系串联。

示例:
```javascript
// 架构师任务
TaskCreate({
  subject: "[architect] REQ-002 技术调研",
  ...
})  // Task #3

// 后端任务 (依赖技术调研)
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现",
  ...
})  // Task #5

TaskUpdate(5, { addBlockedBy: ["3"] })
```

### Q3: 如果 agent 发现任务描述不清晰怎么办?

**A**: 立即使用 SendMessage 向 team-lead 询问,不要盲目执行。

```javascript
SendMessage({
  type: "message",
  recipient: "team-lead",
  content: "Task #X 的具体工作第3项不清楚,请问是指...",
  summary: "Task #X 需求澄清"
})
```

### Q4: 如果 agent 完成任务后发现还有遗漏怎么办?

**A**: 不要修改已完成的任务状态,创建新的补充任务。

```javascript
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现 - 补充 API 限流",
  description: "为 Task #5 遗漏的 API 限流功能补充实现",
  ...
})
```

### Q5: 如果紧急情况需要跨角色领取任务怎么办?

**A**: 先向 team-lead 申请,获得批准后再领取。

```javascript
SendMessage({
  type: "message",
  recipient: "team-lead",
  content: "backend-leader 暂时无法处理 Task #5,我可以代为完成吗?",
  summary: "申请跨角色领取 Task #5"
})
```

---

## 八、总结

遵循本规范创建任务,可以达到以下效果:

1. **角色分配准确**: 通过 `[角色名]` 标识和警告声明,防止跨角色领取
2. **任务描述清晰**: 使用标准模板,确保目标、工作、交付物、依赖都清楚
3. **执行高效**: Agent 无需反复询问,可以直接按步骤执行
4. **验收简单**: 交付物明确,team-lead 可以快速验收
5. **追溯方便**: 任务记录完整,便于后续分析和改进

---

**文档版本**: 1.0
**创建日期**: 2026-02-15
**创建者**: team-lead
**最后更新**: 2026-02-15

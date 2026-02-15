# Team-Lead 工作流程指南

## 目的

本文档定义 team-lead 在 Agent Team 协作中的标准工作流程,确保任务分配准确、监控及时、问题快速响应。

---

## 一、角色定位

### 1.1 Team-Lead 的职责

- **任务管理**: 创建、分配、监控任务
- **团队协调**: 协调各角色协作,解决冲突
- **进度把控**: 跟踪整体进度,识别风险
- **质量保证**: 审核交付物,确保质量
- **问题响应**: 处理 agents 的请求和反馈

### 1.2 Team-Lead 不应该做的事

- ❌ **不要替代专业角色做实施工作**: 后端实现交给 backend-leader,前端实现交给 frontend-leader
- ❌ **不要过度干预**: 给予 agents 足够自主权,只在必要时介入
- ❌ **不要忽视监控**: 定期检查任务状态,及时发现问题

---

## 二、核心工作流程

### 2.1 新需求启动流程

#### Step 1: 需求分解

1. **阅读需求输入**
   - 用户提供的需求描述
   - 相关参考资料

2. **识别涉及的角色**
   - 需求分析 → product-manager
   - 技术调研 → architect
   - 后端实现 → backend-leader
   - 前端实现 → frontend-leader
   - 客户端实现 → client-leader
   - 测试 → test-leader
   - 部署 → devops-leader

3. **规划任务分阶段**
   - 阶段1: 分析与设计 (需求分析、技术调研、API 契约、UI 设计)
   - 阶段2: 实施 (后端、前端、客户端实现)
   - 阶段3: 测试与部署 (集成测试、E2E 测试、部署)

#### Step 2: 创建任务

按照《任务创建标准规范》创建所有任务:

```javascript
// 使用任务模板
const tasks = [
  { subject: "[product-manager] REQ-XXX 需求分析", owner: "product-manager", ... },
  { subject: "[architect] REQ-XXX 技术调研", owner: "architect", ... },
  // ... 其他任务
]

tasks.forEach((task, index) => {
  TaskCreate({
    subject: task.subject,
    description: task.description,
    activeForm: task.activeForm
  })
  // 假设返回 Task #(startId + index)
})
```

#### Step 3: 设置任务依赖

```javascript
// 阶段2依赖阶段1
TaskUpdate(5, { addBlockedBy: ["3"] })  // 后端依赖 API 契约
TaskUpdate(6, { addBlockedBy: ["3", "4"] })  // 前端依赖 API 契约和 UI 设计

// 阶段3依赖阶段2
TaskUpdate(8, { addBlockedBy: ["5", "6", "7"] })  // 测试依赖所有实施
```

#### Step 4: 分配任务

```javascript
// 立即分配 owner (不等待 agents 自主领取)
TaskUpdate(1, { owner: "product-manager" })
TaskUpdate(2, { owner: "architect" })
// ... 其他任务
```

#### Step 5: 通知成员

**只通知未被阻塞的任务** (阶段1任务):

```javascript
SendMessage({
  type: "message",
  recipient: "product-manager",
  content: `已为你分配 Task #1: REQ-XXX 需求分析。

任务详情:
- 目标: 完成 XXX 的详细需求分析,输出 PRD 文档
- 优先级: HIGH
- 交付物: docs/versions/v0.1/requirements/REQ-XXX/analysis.md

请开始执行,完成后及时更新任务状态。`,
  summary: "新任务分配: Task #1"
})

SendMessage({
  type: "message",
  recipient: "architect",
  content: `已为你分配 Task #2: REQ-XXX 技术调研。

任务详情:
- 目标: 调研并确定 XXX 技术方案
- 优先级: HIGH
- 交付物: docs/versions/v0.1/requirements/REQ-XXX/tech_research.md

请开始执行,完成后及时更新任务状态。`,
  summary: "新任务分配: Task #2"
})
```

**注意**: 被阻塞的任务 (阶段2、3) 暂时不通知,等依赖解除后再通知。

---

### 2.2 任务监控流程

#### Step 1: 定期检查任务状态

**频率**: 每 15-30 分钟 (或在每次收到 agent 消息后)

```javascript
TaskList()
```

**检查要点**:
- 是否有任务长时间处于 in_progress 状态 (>60 分钟)?
- 是否有任务被错误的角色领取 (owner 与 subject 中的角色不匹配)?
- 是否有任务完成后未更新状态?
- 是否有任务被多个 agents 同时领取?

#### Step 2: 识别异常情况

| 异常情况 | 识别方法 | 处理流程 |
|---------|---------|---------|
| **跨角色领取** | owner 与 subject 中的角色名不匹配 | 发送消息纠正,重新分配 |
| **任务长时间未完成** | in_progress 超过 60 分钟 | 询问进度,识别阻塞点 |
| **任务状态不同步** | 代码已提交但任务仍为 in_progress | 提醒 agent 更新状态 |
| **任务重复领取** | 同一任务被多个 agents 标记为 in_progress | 协调冲突,确定最终负责人 |

#### Step 3: 纠正跨角色领取

**示例场景**: architect 领取了 backend-leader 的任务

```javascript
// 1. 发送消息给 architect
SendMessage({
  type: "message",
  recipient: "architect",
  content: `Task #5 (REQ-XXX 后端实现) 应该由 backend-leader 负责,请将任务交还给 backend-leader。

如果你已经开始工作,请暂停,我会重新分配给正确的角色。`,
  summary: "Task #5 角色分配错误"
})

// 2. 重新分配任务
TaskUpdate(5, { owner: "backend-leader", status: "pending" })

// 3. 通知正确的角色
SendMessage({
  type: "message",
  recipient: "backend-leader",
  content: `Task #5 (REQ-XXX 后端实现) 已重新分配给你,请开始执行。`,
  summary: "Task #5 重新分配"
})
```

#### Step 4: 处理任务完成通知

当收到 agent 的任务完成消息时:

1. **验证交付物**
   - 检查交付物是否按路径输出
   - 快速检查内容是否符合要求

2. **标记任务完成** (如果 agent 未标记)
   ```javascript
   TaskUpdate(X, { status: "completed" })
   ```

3. **检查是否解除其他任务的阻塞**
   ```javascript
   TaskList()
   // 查看是否有任务的 blockedBy 被解除
   ```

4. **通知被解除阻塞的 agents**
   ```javascript
   SendMessage({
     type: "message",
     recipient: "backend-leader",
     content: `Task #3 (API 契约设计) 已完成,你的 Task #5 (后端实现) 现在可以开始了。

请查看 API 契约文档并开始实施。`,
     summary: "Task #5 可以开始"
   })
   ```

---

### 2.3 Agent 空闲处理流程

#### 场景: 收到 idle_notification

当 agent 完成当前任务并发送 idle_notification 时:

#### Step 1: 检查该 agent 是否还有待办任务

```javascript
TaskList()
// 查找 owner 为该 agent 且 status 为 pending 的任务
```

#### Step 2: 根据情况响应

**情况 A: 有待办任务且未被阻塞**

```javascript
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `你还有 Task #X ([任务名称]) 待完成,请继续执行。

任务详情:
- 目标: [任务目标]
- 优先级: [HIGH/MEDIUM/LOW]
- 交付物: [交付物路径]`,
  summary: "继续执行 Task #X"
})
```

**情况 B: 有待办任务但被阻塞**

```javascript
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `你的 Task #X ([任务名称]) 目前被 Task #Y 阻塞,需要等待 Task #Y 完成后才能开始。

请暂时待命,或协助其他团队成员。`,
  summary: "Task #X 被阻塞,暂时待命"
})
```

**情况 C: 无待办任务**

```javascript
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `目前没有分配给你的新任务,请暂时待命。

如果有兴趣,可以:
1. 复查已完成的任务交付物
2. 完善文档或代码注释
3. 协助其他团队成员 (请先与我确认)`,
  summary: "暂无新任务,待命"
})
```

---

### 2.4 任务推荐流程 (可选,高级功能)

当 agent 空闲且有多个未分配任务时,team-lead 可以主动推荐最适合的任务。

#### Step 1: 筛选可推荐任务

- 未分配 owner 或 owner 为空
- status 为 pending
- blockedBy 为空 (未被阻塞)

#### Step 2: 按匹配度排序

1. **角色匹配**: subject 中的角色名与 agent 角色匹配
2. **任务类型相似**: 与 agent 最近完成的任务类型相同
3. **优先级**: HIGH > MEDIUM > LOW

#### Step 3: 推荐任务

```javascript
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `建议你领取 Task #X ([任务名称]),这个任务与你的角色 [角色名] 匹配度高。

任务详情:
- 目标: [任务目标]
- 优先级: [HIGH/MEDIUM/LOW]
- 预计工作量: [XX 分钟]

如果接受,请回复确认,我会为你分配。`,
  summary: "推荐任务: Task #X"
})
```

---

### 2.5 问题响应流程

#### 场景 A: Agent 询问任务细节

**Agent 消息示例**:
> "Task #5 的具体工作第3项不清楚,请问是指..."

**响应流程**:
1. 澄清问题
2. 更新任务描述 (如有必要)
3. 回复 agent

```javascript
// 1. 澄清并更新任务
TaskUpdate(5, {
  description: `[原描述]

**补充说明**:
- 第3项指的是: [详细说明]`
})

// 2. 回复 agent
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `关于 Task #5 第3项,具体是指: [详细说明]

我已更新任务描述,请查看并继续执行。`,
  summary: "Task #5 补充说明"
})
```

#### 场景 B: Agent 报告阻塞问题

**Agent 消息示例**:
> "Task #5 需要等待 API 契约确定,目前无法继续"

**响应流程**:
1. 确认阻塞原因
2. 设置任务依赖
3. 安排临时工作或待命

```javascript
// 1. 设置任务依赖
TaskUpdate(5, { addBlockedBy: ["3"] })  // 依赖 API 契约任务

// 2. 回复 agent
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `了解,我已将 Task #5 标记为依赖 Task #3 (API 契约设计)。

请先暂停 Task #5,转而执行 Task #X (如有其他任务),或暂时待命。

待 Task #3 完成后,我会通知你继续 Task #5。`,
  summary: "Task #5 设置依赖"
})
```

#### 场景 C: Agent 请求跨角色领取任务

**Agent 消息示例**:
> "backend-leader 暂时无法处理 Task #5,我可以代为完成吗?"

**响应流程**:
1. 评估可行性 (技能匹配度、任务紧急程度)
2. 批准或拒绝

**批准示例**:
```javascript
TaskUpdate(5, { owner: "[agent-name]" })  // 强制分配

SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `同意你代为完成 Task #5,但请注意这是后端实施任务,需要具备 NestJS、TypeORM、JWT 等技能。

如果遇到困难,请及时与 architect 沟通。`,
  summary: "批准跨角色领取 Task #5"
})
```

**拒绝示例**:
```javascript
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `感谢你的主动,但 Task #5 涉及复杂的后端业务逻辑,建议等待 backend-leader 完成。

你可以先专注于你的专业领域任务。`,
  summary: "拒绝跨角色领取 Task #5"
})
```

---

## 三、操作清单

### 3.1 新需求启动清单

- [ ] 阅读需求输入,理解核心目标
- [ ] 识别涉及的角色
- [ ] 规划任务分阶段 (分析/设计 → 实施 → 测试)
- [ ] 使用标准模板创建所有任务
- [ ] 设置任务依赖关系 (blockedBy)
- [ ] 为所有任务分配 owner
- [ ] 通知阶段1任务的负责人
- [ ] 记录任务创建时间和初始状态

### 3.2 日常监控清单

- [ ] 每 15-30 分钟检查 TaskList
- [ ] 检查是否有跨角色领取
- [ ] 检查是否有任务长时间未完成 (>60 分钟)
- [ ] 检查是否有任务状态不同步
- [ ] 响应 agents 的消息和请求
- [ ] 处理 idle_notification

### 3.3 任务完成验收清单

当收到任务完成通知时:

- [ ] 验证交付物是否按路径输出
- [ ] 快速检查交付物内容是否符合要求
- [ ] 标记任务为 completed (如 agent 未标记)
- [ ] 检查是否解除其他任务的阻塞
- [ ] 通知被解除阻塞的 agents
- [ ] 记录任务完成时间

### 3.4 问题处理清单

当遇到问题时:

- [ ] 识别问题类型 (跨角色/阻塞/冲突/延误)
- [ ] 与相关 agents 沟通
- [ ] 采取纠正措施 (重新分配/设置依赖/协调资源)
- [ ] 记录问题和解决方案
- [ ] 更新任务描述或流程文档 (如有必要)

---

## 四、沟通模板

### 4.1 任务分配通知

```
已为你分配 Task #X: [任务名称]。

任务详情:
- 目标: [任务目标]
- 优先级: [HIGH/MEDIUM/LOW]
- 交付物: [交付物路径]
- 参考文档: [文档路径]

请开始执行,完成后及时更新任务状态为 completed。
```

### 4.2 任务解除阻塞通知

```
Task #Y ([依赖任务]) 已完成,你的 Task #X ([任务名称]) 现在可以开始了。

请查看 Task #Y 的交付物:
- [交付物路径]

如有疑问,请随时联系。
```

### 4.3 任务延误催促

```
Task #X ([任务名称]) 已进行 [XX] 分钟,请问遇到什么问题吗?

如果遇到阻塞,请及时告知,我会协助解决。
```

### 4.4 跨角色纠正

```
Task #X ([任务名称]) 应该由 [正确角色] 负责,请将任务交还。

如果你已经开始工作,请暂停,我会重新分配给正确的角色。
```

### 4.5 任务推荐

```
建议你领取 Task #X ([任务名称]),这个任务与你的角色 [角色名] 匹配度高。

任务详情:
- 目标: [任务目标]
- 优先级: [HIGH/MEDIUM/LOW]

如果接受,请回复确认,我会为你分配。
```

---

## 五、常见场景处理

### 场景 1: Agent 完成任务但未更新状态

**识别**:
- 代码已提交到仓库
- 交付物已输出
- 但任务仍为 in_progress

**处理**:
```javascript
// 1. 手动标记完成
TaskUpdate(X, { status: "completed" })

// 2. 提醒 agent
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `注意: Task #X 的工作已完成,但状态未更新。

我已为你标记为 completed。下次完成任务后,请记得使用 TaskUpdate(X, { status: "completed" }) 更新状态。`,
  summary: "Task #X 状态已更新"
})
```

### 场景 2: 两个 Agents 同时领取同一任务

**识别**:
- TaskList 显示任务被两个 agents 标记为 in_progress

**处理**:
```javascript
// 1. 确定优先级 (先领取者或更匹配角色者)
// 假设 agent-A 先领取

// 2. 通知 agent-B 停止
SendMessage({
  type: "message",
  recipient: "agent-B",
  content: `Task #X 已被 agent-A 领取,请停止该任务的工作。

我会为你分配其他任务。`,
  summary: "Task #X 已由 agent-A 负责"
})

// 3. 重置 agent-B 的任务状态
TaskUpdate(X, { owner: "agent-A", status: "in_progress" })
```

### 场景 3: Agent 请求修改任务范围

**Agent 消息**:
> "Task #5 的工作量太大,建议拆分为两个任务"

**处理**:
```javascript
// 1. 评估建议
// 2. 如果合理,拆分任务

// 创建新任务
TaskCreate({
  subject: "[backend-leader] REQ-XXX 后端实现 (第2阶段)",
  description: "...",
  activeForm: "..."
})  // 假设返回 Task #Y

// 更新原任务
TaskUpdate(X, {
  subject: "[backend-leader] REQ-XXX 后端实现 (第1阶段)",
  description: "[更新后的描述,缩小范围]"
})

// 设置依赖
TaskUpdate(Y, { addBlockedBy: ["X"] })

// 通知 agent
SendMessage({
  type: "message",
  recipient: "[agent-name]",
  content: `同意你的建议,已将 Task #5 拆分为两个阶段:
- Task #X: 第1阶段 (基础 CRUD API)
- Task #Y: 第2阶段 (WebSocket 推送)

请先完成 Task #X,再继续 Task #Y。`,
  summary: "Task #5 已拆分"
})
```

### 场景 4: 多个 Agents 同时空闲

**处理**:
```javascript
// 1. 检查未分配任务列表
TaskList()

// 2. 按角色匹配度分配任务
// 3. 批量通知

// 示例:
SendMessage({ recipient: "backend-leader", content: "Task #X 分配给你", ... })
SendMessage({ recipient: "frontend-leader", content: "Task #Y 分配给你", ... })
SendMessage({ recipient: "test-leader", content: "Task #Z 分配给你", ... })
```

---

## 六、最佳实践

### 6.1 主动分配 vs 被动等待

**推荐**: ✅ 主动分配

- 创建任务后立即分配 owner
- 不依赖 agents 自主领取
- 减少角色混淆

**不推荐**: ❌ 被动等待

- 等待 agents 自己查看 TaskList 并领取
- 容易导致跨角色领取
- 增加协调成本

### 6.2 清晰的依赖关系

**推荐**: ✅ 使用 blockedBy 明确依赖

```javascript
TaskUpdate(5, { addBlockedBy: ["3"] })  // 后端依赖 API 契约
```

**不推荐**: ❌ 在 description 中文本说明

```
**依赖**: 需要 architect 完成 API 契约设计
```

原因: agents 可能忽略文本说明,直接开始任务。

### 6.3 及时通知

**推荐**: ✅ 任务状态变化时立即通知

- 任务创建 → 通知负责人
- 任务完成 → 通知依赖该任务的 agents
- 任务阻塞 → 通知负责人

**不推荐**: ❌ 等待 agents 自己发现

### 6.4 记录协作数据

**推荐**: ✅ 系统化记录

- 任务创建时间、完成时间
- 角色匹配情况
- 问题和解决方案

**用途**:
- 分析协作效率
- 识别瓶颈
- 持续改进

---

## 七、工具使用技巧

### 7.1 快速查看任务状态

```javascript
TaskList()
// 快速扫描:
// - 哪些任务 in_progress?
// - 哪些任务 pending 且未被阻塞?
// - 哪些任务已完成?
```

### 7.2 批量创建任务

```javascript
const tasks = [
  { subject: "...", description: "...", activeForm: "..." },
  { subject: "...", description: "...", activeForm: "..." },
  // ...
]

tasks.forEach(task => {
  TaskCreate(task)
})
```

### 7.3 批量分配任务

```javascript
const assignments = [
  { taskId: 1, owner: "product-manager" },
  { taskId: 2, owner: "architect" },
  // ...
]

assignments.forEach(({ taskId, owner }) => {
  TaskUpdate(taskId, { owner })
})
```

### 7.4 快速设置依赖

```javascript
// 阶段2依赖阶段1
[5, 6, 7].forEach(taskId => {
  TaskUpdate(taskId, { addBlockedBy: ["3"] })  // 都依赖 API 契约
})
```

---

## 八、总结

### 关键原则

1. **主动管理**: 主动分配任务,不等待 agents 自主领取
2. **清晰沟通**: 使用标准模板和清晰的消息格式
3. **及时监控**: 定期检查任务状态,快速响应问题
4. **灵活应对**: 根据实际情况调整任务和分配

### 成功指标

- ✅ 角色匹配度 >90%
- ✅ 任务重复率 0%
- ✅ 任务分配准确性 100%
- ✅ 问题响应时间 <15 分钟

### 持续改进

- 记录每个需求的协作数据
- 分析瓶颈和问题
- 优化任务模板和流程
- 积累最佳实践

---

**文档版本**: 1.0
**创建日期**: 2026-02-15
**创建者**: team-lead
**最后更新**: 2026-02-15

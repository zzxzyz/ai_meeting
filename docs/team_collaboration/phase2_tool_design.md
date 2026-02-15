# 阶段2: 工具层优化技术设计文档

## 文档信息

- **版本**: 1.0
- **创建日期**: 2026-02-15
- **创建者**: architect
- **状态**: 设计阶段

---

## 一、设计目标

### 1.1 核心目标

从系统层面解决 REQ-001 回顾中暴露的协作问题:

1. **角色匹配问题**: 添加 `requiredRole` 字段,系统化管理角色分配
2. **并发控制问题**: 添加 `version` 字段,实现乐观锁机制
3. **任务过滤问题**: TaskList 支持角色过滤,减少干扰
4. **权限验证问题**: TaskUpdate 支持角色匹配验证

### 1.2 设计原则

1. **向后兼容**: 新字段可选,不影响现有任务
2. **渐进增强**: 可以逐步启用新特性
3. **最小侵入**: 尽量复用现有工具结构
4. **清晰语义**: 字段命名清晰,易于理解

---

## 二、Task JSON Schema 设计

### 2.1 新增字段

#### requiredRole (可选字符串)

**用途**: 指定任务所需的角色,用于角色匹配验证

**类型**: `string | undefined`

**取值范围**:
- `"team-lead"`
- `"product-manager"`
- `"architect"`
- `"backend-leader"`
- `"frontend-leader"`
- `"client-leader"`
- `"test-leader"`
- `"devops-leader"`
- `undefined` (未指定,任何角色都可以领取)

**语义**:
- 当 `requiredRole` 有值时,只有匹配该角色的 agent 才能将任务的 `owner` 设为自己
- `team-lead` 拥有特权,可以通过 `forceAssign` 参数跨角色分配

**示例**:
```json
{
  "id": "5",
  "subject": "[backend-leader] REQ-002 后端实现",
  "requiredRole": "backend-leader",
  "owner": "",
  "status": "pending"
}
```

#### version (整数)

**用途**: 实现乐观锁,防止并发冲突

**类型**: `number`

**初始值**: `1`

**更新规则**:
- 每次 TaskUpdate 成功后,`version` 自动 +1
- TaskUpdate 时需要提供 `expectedVersion`,如果不匹配则更新失败

**语义**:
- 类似数据库的乐观锁机制
- 防止 "丢失更新" 问题

**示例**:
```json
{
  "id": "5",
  "version": 3,  // 已被修改2次
  "status": "in_progress"
}
```

#### taskType (可选枚举)

**用途**: 标识任务的类型,方便分类和统计

**类型**: `string | undefined`

**取值范围**:
- `"requirement_analysis"` - 需求分析
- `"tech_research"` - 技术调研
- `"architecture_design"` - 架构设计
- `"api_design"` - API 设计
- `"ui_design"` - UI/UX 设计
- `"backend_implementation"` - 后端实现
- `"frontend_implementation"` - 前端实现
- `"client_implementation"` - 客户端实现
- `"testing"` - 测试
- `"deployment"` - 部署
- `"documentation"` - 文档编写
- `"code_review"` - 代码审查
- `"bug_fix"` - Bug 修复
- `"optimization"` - 性能优化
- `"other"` - 其他

**语义**:
- 与 `requiredRole` 配合,可以建立任务类型-角色映射
- 用于任务统计和分析

**示例**:
```json
{
  "id": "5",
  "taskType": "backend_implementation",
  "requiredRole": "backend-leader"
}
```

### 2.2 完整 Schema

```typescript
interface Task {
  // === 现有字段 ===
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
  owner?: string;
  metadata?: Record<string, any>;
  blocks?: string[];        // 此任务阻塞的任务列表
  blockedBy?: string[];     // 阻塞此任务的任务列表
  createdAt?: string;       // ISO 8601 时间戳
  updatedAt?: string;       // ISO 8601 时间戳

  // === 新增字段 ===
  requiredRole?: string;    // 所需角色
  version: number;          // 版本号,用于乐观锁
  taskType?: string;        // 任务类型
}
```

### 2.3 向后兼容性

**兼容策略**:

1. **读取现有任务**:
   - 如果任务文件中没有 `version` 字段,默认为 `1`
   - 如果任务文件中没有 `requiredRole` 字段,默认为 `undefined`
   - 如果任务文件中没有 `taskType` 字段,默认为 `undefined`

2. **写入任务**:
   - 新创建的任务自动包含 `version: 1`
   - 更新任务时,如果原任务没有 `version`,则初始化为 `1` 后再更新
   - 所有字段都写入文件,避免歧义

3. **工具行为**:
   - 如果 `requiredRole` 为 `undefined`,则不进行角色验证(保持原有行为)
   - 如果 TaskUpdate 未提供 `expectedVersion`,则跳过版本检查(保持原有行为)

---

## 三、TaskCreate 工具修改

### 3.1 新增参数

```typescript
TaskCreate({
  // === 现有参数 ===
  subject: string;
  description: string;
  activeForm?: string;
  metadata?: Record<string, any>;

  // === 新增参数 ===
  requiredRole?: string;    // 所需角色
  taskType?: string;        // 任务类型
})
```

### 3.2 行为变更

1. **初始化 version**:
   - 所有新创建的任务自动设置 `version: 1`

2. **验证 requiredRole**:
   - 如果提供了 `requiredRole`,验证其值是否在允许的角色列表中
   - 如果无效,返回错误

3. **验证 taskType**:
   - 如果提供了 `taskType`,验证其值是否在允许的类型列表中
   - 如果无效,返回错误

### 3.3 示例

```javascript
// 创建带角色限制的任务
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现",
  description: "...",
  activeForm: "实现后端服务",
  requiredRole: "backend-leader",
  taskType: "backend_implementation"
})

// 返回:
// Task #5 created
// {
//   "id": "5",
//   "subject": "[backend-leader] REQ-002 后端实现",
//   "requiredRole": "backend-leader",
//   "taskType": "backend_implementation",
//   "version": 1,
//   "status": "pending",
//   "owner": ""
// }
```

---

## 四、TaskList 工具修改

### 4.1 新增参数

```typescript
TaskList({
  roleFilter?: string;  // 角色过滤器
})
```

### 4.2 过滤逻辑

**当提供 `roleFilter` 时**:

1. 返回满足以下任一条件的任务:
   - `requiredRole === roleFilter` (角色匹配)
   - `requiredRole === undefined` (未指定角色,任何人都可以看到)
   - `owner === roleFilter` (已被该角色领取)

2. 不返回 `requiredRole` 为其他角色的任务

**当未提供 `roleFilter` 时**:
- 返回所有任务(保持原有行为)

### 4.3 返回格式

```typescript
interface TaskListResult {
  id: string;
  subject: string;
  status: "pending" | "in_progress" | "completed";
  owner: string;
  blockedBy: string[];
  requiredRole?: string;    // 新增
  version: number;          // 新增
  taskType?: string;        // 新增
}
```

### 4.4 示例

```javascript
// backend-leader 调用
TaskList({ roleFilter: "backend-leader" })

// 返回:
// [
//   {
//     "id": "3",
//     "subject": "[architect] 技术调研",
//     "requiredRole": undefined,  // 未指定角色,所有人可见
//     "status": "completed",
//     "owner": "architect",
//     "blockedBy": [],
//     "version": 2
//   },
//   {
//     "id": "5",
//     "subject": "[backend-leader] 后端实现",
//     "requiredRole": "backend-leader",  // 角色匹配
//     "status": "pending",
//     "owner": "",
//     "blockedBy": ["3"],
//     "version": 1,
//     "taskType": "backend_implementation"
//   },
//   // 不包含 requiredRole 为 "frontend-leader" 的任务
// ]
```

---

## 五、TaskUpdate 工具修改

### 5.1 新增参数

```typescript
TaskUpdate({
  taskId: string;

  // === 现有可选参数 ===
  status?: "pending" | "in_progress" | "completed" | "deleted";
  subject?: string;
  description?: string;
  activeForm?: string;
  owner?: string;
  metadata?: Record<string, any>;
  addBlocks?: string[];
  addBlockedBy?: string[];

  // === 新增参数 ===
  expectedVersion?: number;  // 期望的版本号(乐观锁)
  forceAssign?: boolean;     // 强制分配(team-lead 特权)
})
```

### 5.2 验证逻辑

#### 5.2.1 版本验证 (乐观锁)

**触发条件**: 提供了 `expectedVersion` 参数

**验证逻辑**:
1. 读取任务的当前 `version`
2. 如果 `currentVersion !== expectedVersion`,则返回错误:
   ```
   Error: Task version mismatch. Expected: 5, Current: 6.
   Another agent has modified this task. Please refresh and retry.
   ```
3. 如果匹配,执行更新并将 `version` 加 1

**目的**: 防止并发冲突,避免丢失更新

#### 5.2.2 角色匹配验证

**触发条件**: 修改 `owner` 字段,且任务有 `requiredRole`

**验证逻辑**:

1. **获取调用者身份**:
   - 从系统上下文中获取当前 agent 的角色名

2. **检查是否为强制分配**:
   - 如果 `forceAssign === true` 且调用者为 `team-lead`,跳过角色验证

3. **执行角色验证**:
   - 如果 `newOwner === requiredRole`,允许
   - 如果 `newOwner` 不匹配 `requiredRole`,返回错误:
     ```
     Error: Role mismatch. Task requires "backend-leader", but you are "frontend-leader".
     Use TaskList({ roleFilter: "frontend-leader" }) to find tasks for your role.
     ```

4. **特殊情况**:
   - 如果 `requiredRole === undefined`,不进行验证(保持原有行为)
   - 如果 `owner` 设为空字符串(释放任务),不进行验证

#### 5.2.3 状态转换验证

**触发条件**: 修改 `status` 字段

**允许的状态转换**:
```
pending -> in_progress
pending -> deleted
in_progress -> completed
in_progress -> deleted
completed -> deleted  (仅 team-lead)
```

**禁止的状态转换**:
```
completed -> pending
completed -> in_progress
in_progress -> pending
```

**验证逻辑**:
1. 检查状态转换是否在允许列表中
2. 如果禁止,返回错误:
   ```
   Error: Invalid status transition: "completed" -> "pending".
   Allowed transitions from "completed": ["deleted"] (team-lead only).
   ```

### 5.3 自动更新

1. **version 自动递增**:
   - 每次成功更新后,`version` 自动 +1

2. **updatedAt 自动更新**:
   - 每次成功更新后,`updatedAt` 更新为当前时间

### 5.4 示例

#### 示例 1: 使用乐观锁更新

```javascript
// Agent 读取任务
TaskGet("5")
// { id: "5", status: "pending", version: 1, ... }

// Agent 尝试领取任务
TaskUpdate("5", {
  owner: "backend-leader",
  status: "in_progress",
  expectedVersion: 1  // 期望版本为 1
})

// 成功: Task #5 updated, version: 1 -> 2
```

**并发冲突场景**:
```javascript
// Agent A 读取任务
TaskGet("5")  // version: 1

// Agent B 读取任务
TaskGet("5")  // version: 1

// Agent A 先更新
TaskUpdate("5", { owner: "backend-leader", expectedVersion: 1 })
// 成功, version: 1 -> 2

// Agent B 后更新
TaskUpdate("5", { owner: "backend-leader-2", expectedVersion: 1 })
// 失败: Error: Task version mismatch. Expected: 1, Current: 2.
```

#### 示例 2: 角色验证

```javascript
// frontend-leader 尝试领取 backend 任务
TaskUpdate("5", {
  owner: "frontend-leader",  // 当前 agent 角色
  status: "in_progress"
})

// 失败: Error: Role mismatch. Task requires "backend-leader", but you are "frontend-leader".
```

#### 示例 3: team-lead 强制分配

```javascript
// team-lead 跨角色分配任务
TaskUpdate("5", {
  owner: "architect",  // 架构师
  forceAssign: true    // 强制分配
})

// 成功: Task #5 force-assigned to "architect" (overriding requiredRole: "backend-leader")
```

#### 示例 4: 状态转换验证

```javascript
// 尝试将 completed 任务改回 in_progress
TaskUpdate("5", {
  status: "in_progress"
})

// 失败: Error: Invalid status transition: "completed" -> "in_progress".
```

---

## 六、测试用例设计

### 6.1 TaskCreate 测试

#### TC-01: 创建带 requiredRole 的任务
- **输入**: `TaskCreate({ subject: "...", requiredRole: "backend-leader" })`
- **预期**: 任务创建成功, `version: 1`, `requiredRole: "backend-leader"`

#### TC-02: 创建时 requiredRole 无效
- **输入**: `TaskCreate({ subject: "...", requiredRole: "invalid-role" })`
- **预期**: 返回错误 "Invalid requiredRole"

#### TC-03: 创建时不指定 requiredRole
- **输入**: `TaskCreate({ subject: "..." })`
- **预期**: 任务创建成功, `version: 1`, `requiredRole: undefined`

#### TC-04: 创建带 taskType 的任务
- **输入**: `TaskCreate({ subject: "...", taskType: "backend_implementation" })`
- **预期**: 任务创建成功, `taskType: "backend_implementation"`

### 6.2 TaskList 测试

#### TC-05: 不使用 roleFilter
- **输入**: `TaskList()`
- **预期**: 返回所有任务

#### TC-06: 使用 roleFilter 过滤
- **前置条件**:
  - Task #1: `requiredRole: "backend-leader"`
  - Task #2: `requiredRole: "frontend-leader"`
  - Task #3: `requiredRole: undefined`
- **输入**: `TaskList({ roleFilter: "backend-leader" })`
- **预期**: 返回 Task #1 和 Task #3,不返回 Task #2

#### TC-07: roleFilter 匹配 owner
- **前置条件**: Task #1: `requiredRole: "frontend-leader"`, `owner: "backend-leader"`
- **输入**: `TaskList({ roleFilter: "backend-leader" })`
- **预期**: 返回 Task #1 (因为 owner 匹配)

### 6.3 TaskUpdate 乐观锁测试

#### TC-08: 版本匹配
- **前置条件**: Task #1: `version: 3`
- **输入**: `TaskUpdate("1", { status: "completed", expectedVersion: 3 })`
- **预期**: 更新成功, `version: 3 -> 4`

#### TC-09: 版本不匹配
- **前置条件**: Task #1: `version: 5`
- **输入**: `TaskUpdate("1", { status: "completed", expectedVersion: 3 })`
- **预期**: 返回错误 "Task version mismatch"

#### TC-10: 不提供 expectedVersion
- **前置条件**: Task #1: `version: 3`
- **输入**: `TaskUpdate("1", { status: "completed" })`
- **预期**: 更新成功, `version: 3 -> 4` (跳过版本检查)

### 6.4 TaskUpdate 角色验证测试

#### TC-11: 角色匹配
- **前置条件**: Task #1: `requiredRole: "backend-leader"`
- **调用者**: `backend-leader`
- **输入**: `TaskUpdate("1", { owner: "backend-leader" })`
- **预期**: 更新成功

#### TC-12: 角色不匹配
- **前置条件**: Task #1: `requiredRole: "backend-leader"`
- **调用者**: `frontend-leader`
- **输入**: `TaskUpdate("1", { owner: "frontend-leader" })`
- **预期**: 返回错误 "Role mismatch"

#### TC-13: team-lead 强制分配
- **前置条件**: Task #1: `requiredRole: "backend-leader"`
- **调用者**: `team-lead`
- **输入**: `TaskUpdate("1", { owner: "architect", forceAssign: true })`
- **预期**: 更新成功

#### TC-14: 非 team-lead 使用 forceAssign
- **前置条件**: Task #1: `requiredRole: "backend-leader"`
- **调用者**: `frontend-leader`
- **输入**: `TaskUpdate("1", { owner: "frontend-leader", forceAssign: true })`
- **预期**: 返回错误 "Only team-lead can use forceAssign"

#### TC-15: requiredRole 为 undefined
- **前置条件**: Task #1: `requiredRole: undefined`
- **调用者**: `任何角色`
- **输入**: `TaskUpdate("1", { owner: "任何角色" })`
- **预期**: 更新成功 (不进行角色验证)

### 6.5 TaskUpdate 状态转换测试

#### TC-16: 允许的转换 (pending -> in_progress)
- **前置条件**: Task #1: `status: "pending"`
- **输入**: `TaskUpdate("1", { status: "in_progress" })`
- **预期**: 更新成功

#### TC-17: 允许的转换 (in_progress -> completed)
- **前置条件**: Task #1: `status: "in_progress"`
- **输入**: `TaskUpdate("1", { status: "completed" })`
- **预期**: 更新成功

#### TC-18: 禁止的转换 (completed -> in_progress)
- **前置条件**: Task #1: `status: "completed"`
- **输入**: `TaskUpdate("1", { status: "in_progress" })`
- **预期**: 返回错误 "Invalid status transition"

#### TC-19: 禁止的转换 (in_progress -> pending)
- **前置条件**: Task #1: `status: "in_progress"`
- **输入**: `TaskUpdate("1", { status: "pending" })`
- **预期**: 返回错误 "Invalid status transition"

### 6.6 并发场景测试

#### TC-20: 两个 agents 同时领取任务
- **前置条件**: Task #1: `status: "pending"`, `version: 1`
- **Agent A**: `TaskUpdate("1", { owner: "backend-leader", expectedVersion: 1 })`
- **Agent B**: `TaskUpdate("1", { owner: "backend-leader-2", expectedVersion: 1 })`
- **预期**: 一个成功,一个失败 (版本冲突)

#### TC-21: Agent 读取过期数据
- **前置条件**: Task #1: `version: 1`
- **操作序列**:
  1. Agent A 读取: `TaskGet("1")` -> `version: 1`
  2. Agent B 更新: `TaskUpdate("1", { status: "in_progress" })` -> `version: 2`
  3. Agent A 更新: `TaskUpdate("1", { owner: "...", expectedVersion: 1 })`
- **预期**: Agent A 更新失败 (版本冲突)

---

## 七、实施计划

### 7.1 阶段划分

#### 阶段 2.1: Schema 和 TaskCreate (1-2 天)
- 实现新的 Task Schema
- 修改 TaskCreate 工具
- 编写单元测试
- 文档更新

#### 阶段 2.2: TaskList 和 TaskUpdate (2-3 天)
- 修改 TaskList 工具
- 修改 TaskUpdate 工具 (乐观锁)
- 编写单元测试
- 集成测试

#### 阶段 2.3: 角色验证和状态机 (2-3 天)
- 实现角色验证逻辑
- 实现状态转换验证
- 编写单元测试
- 端到端测试

#### 阶段 2.4: 集成和验证 (1-2 天)
- 在实际需求中试用
- 收集反馈
- 优化和修复问题

### 7.2 实施优先级

1. **P0 (必须)**:
   - `version` 字段和乐观锁
   - `requiredRole` 字段和角色验证
   - TaskList 角色过滤

2. **P1 (重要)**:
   - 状态转换验证
   - `forceAssign` 参数

3. **P2 (可选)**:
   - `taskType` 字段
   - 任务类型统计

---

## 八、风险和缓解

### 8.1 风险识别

#### 风险 1: 现有任务兼容性问题
- **描述**: 现有任务文件没有新字段,可能导致工具异常
- **影响**: 高
- **缓解**:
  - 工具读取时设置默认值
  - 编写迁移脚本
  - 充分测试向后兼容性

#### 风险 2: 乐观锁性能影响
- **描述**: 频繁的版本检查可能影响性能
- **影响**: 低
- **缓解**:
  - 版本检查只是简单的数字比较,性能开销极小
  - 可以通过 `expectedVersion` 参数选择性启用

#### 风险 3: 角色验证过于严格
- **描述**: 可能限制灵活性,某些特殊情况无法处理
- **影响**: 中
- **缓解**:
  - 提供 `forceAssign` 参数给 team-lead
  - `requiredRole` 为可选字段,可以不使用

#### 风险 4: 状态转换规则不全
- **描述**: 可能遗漏某些合理的状态转换场景
- **影响**: 中
- **缓解**:
  - 在实际使用中逐步完善规则
  - 提供错误提示,引导用户正确操作

### 8.2 回滚计划

如果阶段2优化出现严重问题,可以回滚到阶段1流程优化:

1. **保留新字段**: `version`, `requiredRole`, `taskType` 继续存在于数据中
2. **禁用验证逻辑**: 修改工具代码,跳过所有验证
3. **依赖流程**: 依赖 team-lead 流程控制和 agents 自觉性

---

## 九、成功指标

### 9.1 定量指标

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| 角色匹配度 | >95% | (匹配任务数 / 总任务数) × 100% |
| 并发冲突率 | <5% | (版本冲突次数 / 总更新次数) × 100% |
| 跨角色领取率 | <5% | (跨角色任务数 / 总任务数) × 100% |
| 无效状态转换次数 | 0 | 统计错误日志 |

### 9.2 定性指标

- Agents 反馈工具易用性良好
- Team-lead 管理效率提升
- 任务分配冲突显著减少

---

## 十、后续演进

### 10.1 阶段3预览: RBAC 和智能推荐

基于阶段2的基础设施,阶段3可以实现:

1. **RBAC 配置文件**:
   ```yaml
   roles:
     backend-leader:
       permissions:
         - claim_task_type: [backend_implementation, bug_fix]
         - update_own_tasks
         - comment_on_all_tasks
   ```

2. **任务类型-角色映射**:
   ```typescript
   const taskTypeRoleMap = {
     "backend_implementation": ["backend-leader"],
     "frontend_implementation": ["frontend-leader"],
     "architecture_design": ["architect"],
     // ...
   }
   ```

3. **智能任务推荐**:
   - 基于 agent 的历史完成记录
   - 基于任务类型-角色映射
   - 基于任务优先级和依赖关系

### 10.2 可能的扩展

1. **任务审批流程**:
   - 某些任务类型需要 team-lead 审批后才能标记为 completed
   - 实现 `TaskApprove` 工具

2. **任务时间跟踪**:
   - 记录任务的领取时间、完成时间
   - 统计平均完成时长

3. **任务评论系统**:
   - Agents 可以在任务上评论
   - 类似 GitHub Issues 的讨论功能

---

## 附录

### A. 角色枚举完整列表

```typescript
const VALID_ROLES = [
  "team-lead",
  "product-manager",
  "architect",
  "backend-leader",
  "frontend-leader",
  "client-leader",
  "test-leader",
  "devops-leader"
] as const;

type Role = typeof VALID_ROLES[number];
```

### B. 任务类型枚举完整列表

```typescript
const VALID_TASK_TYPES = [
  "requirement_analysis",
  "tech_research",
  "architecture_design",
  "api_design",
  "ui_design",
  "backend_implementation",
  "frontend_implementation",
  "client_implementation",
  "testing",
  "deployment",
  "documentation",
  "code_review",
  "bug_fix",
  "optimization",
  "other"
] as const;

type TaskType = typeof VALID_TASK_TYPES[number];
```

### C. 状态转换矩阵

```typescript
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  "pending": ["in_progress", "deleted"],
  "in_progress": ["completed", "deleted"],
  "completed": ["deleted"],  // 仅 team-lead
  "deleted": []              // 终态
};
```

---

**文档状态**: 设计完成,待审查
**下一步**: 创建 JSON Schema 定义文件

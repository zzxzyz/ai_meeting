# 阶段3: RBAC 和智能推荐系统设计

## 文档元信息

- **版本**: 1.0
- **创建日期**: 2026-02-15
- **创建者**: architect
- **状态**: 设计完成

---

## 一、概述

### 1.1 设计目标

基于 REQ-001 协作回顾中识别的问题,设计阶段3的基于角色的访问控制(RBAC)系统和智能推荐机制,实现:

1. **角色权限控制**: 通过 RBAC 配置文件定义角色与任务类型的映射关系
2. **任务领取审批**: 跨角色领取任务需要 team-lead 审批
3. **智能推荐**: 根据角色匹配度和历史记录推荐最适合的任务
4. **优先级管理**: 支持任务优先级排序

### 1.2 适用场景

- **团队规模**: 3+ agents 的协作团队
- **任务复杂度**: 需要专业分工的中大型项目
- **实施时机**: 完成 3-4 个需求开发后,积累足够协作数据

### 1.3 设计原则

1. **最小权限原则**: 默认只允许角色领取匹配的任务类型
2. **灵活性**: 支持审批流程允许特殊情况下的跨角色协作
3. **可配置**: 通过 JSON 配置文件管理,无需修改代码
4. **向后兼容**: 不影响现有任务系统,可选启用

---

##二、任务类型枚举

### 2.1 标准任务类型

定义 8 种标准任务类型,覆盖软件开发全生命周期:

| 任务类型 | 枚举值 | 描述 | 典型交付物 |
|---------|--------|------|-----------|
| 文档类 | `documentation` | 需求分析、技术调研、API 契约、ADR | .md 文档 |
| 设计类 | `design` | UI/UX 设计、交互设计、视觉设计 | 设计文档、原型 |
| 架构类 | `architecture` | 系统架构、技术选型、架构决策 | 架构文档、ADR |
| 后端类 | `backend` | 后端实现、API 开发、数据库设计 | .ts/.js 代码 |
| 前端类 | `frontend` | 前端实现、Web 端开发、组件开发 | .tsx/.jsx 代码 |
| 客户端类 | `client` | 客户端实现、SDK 开发、跨平台适配 | 客户端代码 |
| 测试类 | `testing` | 测试设计、测试执行、质量保障 | 测试代码、测试报告 |
| 运维类 | `devops` | 部署配置、CI/CD、监控告警 | 部署脚本、配置文件 |

### 2.2 任务类型识别规则

任务类型通过以下规则自动识别:

#### 方式1: 显式声明 (推荐)

在任务 `metadata` 字段中声明:

```javascript
TaskCreate({
  subject: "[backend-leader] REQ-002 后端实现",
  description: "...",
  metadata: {
    taskType: "backend"  // 显式声明任务类型
  }
})
```

#### 方式2: 角色推断 (兼容模式)

如果未显式声明,通过任务 subject 中的角色名推断:

| 角色名 | 推断任务类型 |
|--------|-------------|
| `product-manager` | `documentation` 或 `design` |
| `architect` | `architecture` |
| `backend-leader` | `backend` |
| `frontend-leader` | `frontend` |
| `client-leader` | `client` |
| `test-leader` | `testing` |
| `devops-leader` | `devops` |

#### 方式3: 关键词匹配 (兜底方案)

如果前两种方式都无法确定,通过 subject 和 description 关键词匹配:

```javascript
const KEYWORD_MAPPING = {
  documentation: ["需求分析", "技术调研", "API契约", "文档编写"],
  design: ["UI设计", "UX设计", "原型设计", "交互设计"],
  architecture: ["架构设计", "技术选型", "ADR", "系统设计"],
  backend: ["后端实现", "API开发", "数据库", "服务端"],
  frontend: ["前端实现", "Web开发", "组件开发", "页面开发"],
  client: ["客户端", "Electron", "SDK", "跨平台"],
  testing: ["测试", "单元测试", "集成测试", "E2E"],
  devops: ["部署", "CI/CD", "Docker", "监控"]
}
```

### 2.3 多类型任务处理

某些任务可能涉及多个类型(如"后端实现+测试"),处理方式:

1. **主次分明**: 选择主要类型作为 `taskType`,次要类型在 description 中说明
2. **任务拆分**: 将任务拆分为多个子任务,每个子任务一个类型
3. **复合类型**: 使用数组表示 `taskType: ["backend", "testing"]`,匹配任一类型即可

---

## 三、RBAC 配置设计

### 3.1 配置文件结构

配置文件路径: `~/.claude-internal/teams/{team-name}/rbac.json`

```json
{
  "version": "1.0",
  "roles": {
    "team-lead": {
      "permissions": {
        "canClaimAnyTask": true,
        "canApproveAssignment": true,
        "canManageRBAC": true,
        "allowedTaskTypes": ["*"]
      },
      "priority": 100,
      "description": "团队负责人,拥有全部权限"
    },
    "product-manager": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["documentation", "design"]
      },
      "priority": 80,
      "description": "产品经理,负责需求分析和设计评审"
    },
    "architect": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["architecture", "documentation"]
      },
      "priority": 90,
      "description": "架构师,负责架构设计和技术调研"
    },
    "backend-leader": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["backend", "testing"]
      },
      "priority": 70,
      "description": "后端负责人,负责后端实现"
    },
    "frontend-leader": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["frontend", "testing"]
      },
      "priority": 70,
      "description": "前端负责人,负责前端实现"
    },
    "client-leader": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["client", "testing"]
      },
      "priority": 70,
      "description": "客户端负责人,负责客户端实现"
    },
    "test-leader": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["testing"]
      },
      "priority": 75,
      "description": "测试负责人,负责测试和质量保障"
    },
    "devops-leader": {
      "permissions": {
        "canClaimAnyTask": false,
        "canApproveAssignment": false,
        "canManageRBAC": false,
        "allowedTaskTypes": ["devops", "backend"]
      },
      "priority": 70,
      "description": "运维负责人,负责部署和运维"
    }
  },
  "settings": {
    "strictMode": false,
    "requireApprovalForCrossRole": true,
    "autoRejectIfNoPermission": false,
    "recommendationEnabled": true
  }
}
```

### 3.2 权限字段说明

#### `canClaimAnyTask`

- **类型**: boolean
- **说明**: 是否可以领取任何类型的任务,无需审批
- **用途**: 仅 team-lead 为 true,其他角色为 false

#### `canApproveAssignment`

- **类型**: boolean
- **说明**: 是否可以审批其他角色的跨角色领取请求
- **用途**: 仅 team-lead 为 true

#### `canManageRBAC`

- **类型**: boolean
- **说明**: 是否可以修改 RBAC 配置文件
- **用途**: 仅 team-lead 为 true

#### `allowedTaskTypes`

- **类型**: string[] 或 ["*"]
- **说明**: 允许领取的任务类型列表
- **特殊值**: `["*"]` 表示所有类型 (仅 team-lead)

#### `priority`

- **类型**: number (0-100)
- **说明**: 角色优先级,用于智能推荐排序
- **规则**: 数值越高,优先级越高
- **用途**: 当多个角色都可以领取某任务时,优先推荐给优先级高的角色

### 3.3 全局设置说明

#### `strictMode`

- **类型**: boolean
- **默认**: false
- **说明**: 严格模式,禁止跨角色领取任务
- **影响**:
  - `true`: 直接拒绝跨角色领取,无审批流程
  - `false`: 允许跨角色领取,但需审批

#### `requireApprovalForCrossRole`

- **类型**: boolean
- **默认**: true
- **说明**: 跨角色领取是否需要审批
- **影响**:
  - `true`: 发送 `task_assignment_request` 消息等待审批
  - `false`: 直接允许跨角色领取 (不推荐)

#### `autoRejectIfNoPermission`

- **类型**: boolean
- **默认**: false
- **说明**: 无权限时是否自动拒绝,还是仍然提交审批
- **影响**:
  - `true`: 直接拒绝,不提交审批
  - `false`: 提交审批,由 team-lead 决定

#### `recommendationEnabled`

- **类型**: boolean
- **默认**: true
- **说明**: 是否启用智能推荐功能
- **影响**: 决定是否在 TaskList 结果中返回推荐分数

---

## 四、任务领取审批流程

### 4.1 流程图

```
┌─────────────────┐
│ Agent 调用      │
│ TaskUpdate(X,   │
│  {owner: "me"}) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 检查角色权限    │
│ (读取 rbac.json)│
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│ 角色匹配        │  │ 角色不匹配      │
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ 直接分配成功    │  │ 发送审批请求    │
│ TaskUpdate OK   │  │ SendMessage     │
└─────────────────┘  │ (type:          │
                     │  task_assign..  │
                     │  request)       │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Team-lead 审批  │
                     │ SendMessage     │
                     │ (type:          │
                     │  task_assign..  │
                     │  response)      │
                     └────────┬────────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                     ▼                 ▼
            ┌─────────────────┐ ┌─────────────────┐
            │ 批准            │ │ 拒绝            │
            │ TaskUpdate OK   │ │ 任务仍为 pending│
            └─────────────────┘ └─────────────────┘
```

### 4.2 消息格式定义

#### 4.2.1 `task_assignment_request` - 任务领取申请

当 agent 尝试领取不匹配的任务时,系统自动发送此消息到 team-lead:

```json
{
  "type": "task_assignment_request",
  "requestId": "req_20260215_123456_abc",
  "taskId": "5",
  "requester": "frontend-leader",
  "requesterRole": "frontend-leader",
  "taskType": "backend",
  "taskSubject": "[backend-leader] REQ-002 后端实现",
  "reason": "backend-leader 当前不可用,我可以协助完成此任务",
  "timestamp": "2026-02-15T10:30:00Z",
  "metadata": {
    "requesterCurrentTasks": ["3", "4"],
    "taskPriority": "high",
    "estimatedTime": "2 hours"
  }
}
```

**字段说明**:

- `requestId`: 唯一请求 ID,用于关联响应
- `taskId`: 要领取的任务 ID
- `requester`: 申请者的 agent 名称
- `requesterRole`: 申请者的角色
- `taskType`: 任务类型
- `taskSubject`: 任务标题
- `reason`: 申请理由 (agent 自行填写)
- `metadata`: 额外信息,帮助决策

#### 4.2.2 `task_assignment_response` - 审批响应

Team-lead 使用 SendMessage 工具发送审批结果:

**批准示例**:

```json
{
  "type": "task_assignment_response",
  "requestId": "req_20260215_123456_abc",
  "taskId": "5",
  "approve": true,
  "recipient": "frontend-leader",
  "content": "批准你领取 Task #5,注意与 backend-leader 保持沟通",
  "timestamp": "2026-02-15T10:32:00Z"
}
```

**拒绝示例**:

```json
{
  "type": "task_assignment_response",
  "requestId": "req_20260215_123456_abc",
  "taskId": "5",
  "approve": false,
  "recipient": "frontend-leader",
  "content": "此任务涉及数据库设计,建议等待 backend-leader 完成",
  "reason": "任务专业性强,不适合跨角色",
  "timestamp": "2026-02-15T10:32:00Z"
}
```

### 4.3 实现伪代码

#### Agent 侧逻辑

```typescript
// Agent 尝试领取任务
async function claimTask(taskId: string, agentName: string) {
  // 1. 获取任务信息
  const task = await TaskGet(taskId);

  // 2. 检查任务是否已被领取
  if (task.owner && task.owner !== "") {
    throw new Error("任务已被领取");
  }

  // 3. 获取 RBAC 配置
  const rbac = await loadRBACConfig();
  const agentRole = extractRole(agentName); // 从 agent 名称提取角色

  // 4. 确定任务类型
  const taskType = determineTaskType(task);

  // 5. 检查权限
  const roleConfig = rbac.roles[agentRole];
  const hasPermission =
    roleConfig.permissions.canClaimAnyTask ||
    roleConfig.permissions.allowedTaskTypes.includes("*") ||
    roleConfig.permissions.allowedTaskTypes.includes(taskType);

  // 6. 根据权限决定行动
  if (hasPermission) {
    // 直接领取
    await TaskUpdate(taskId, { owner: agentName, status: "in_progress" });
    console.log(`✅ 成功领取 Task #${taskId}`);
  } else {
    // 需要审批
    if (rbac.settings.strictMode) {
      throw new Error("严格模式下禁止跨角色领取任务");
    }

    if (rbac.settings.autoRejectIfNoPermission) {
      throw new Error("无权限领取此任务");
    }

    // 发送审批请求
    const requestId = generateRequestId();
    await SendMessage({
      type: "task_assignment_request",
      recipient: "team-lead",
      content: JSON.stringify({
        requestId,
        taskId,
        requester: agentName,
        requesterRole: agentRole,
        taskType,
        taskSubject: task.subject,
        reason: "需要跨角色协作",
        timestamp: new Date().toISOString()
      }),
      summary: `申请领取 Task #${taskId}`
    });

    console.log(`⏳ 已提交审批请求 ${requestId},等待 team-lead 批准`);
  }
}
```

#### Team-lead 侧逻辑

```typescript
// Team-lead 处理审批请求
async function handleAssignmentRequest(request: AssignmentRequest) {
  // 1. 分析请求
  const { requestId, taskId, requester, taskType, reason } = request;

  // 2. 评估是否批准 (可以是自动决策或人工决策)
  const shouldApprove = evaluateRequest(request);

  // 3. 发送响应
  await SendMessage({
    type: "task_assignment_response",
    recipient: requester,
    request_id: requestId,
    approve: shouldApprove,
    content: shouldApprove
      ? `批准你领取 Task #${taskId}`
      : `拒绝你领取 Task #${taskId},原因: ${reason}`
  });

  // 4. 如果批准,执行分配
  if (shouldApprove) {
    await TaskUpdate(taskId, { owner: requester });
    console.log(`✅ 已将 Task #${taskId} 分配给 ${requester}`);
  }
}

// 评估请求 (示例决策逻辑)
function evaluateRequest(request: AssignmentRequest): boolean {
  // 规则1: 高优先级任务优先批准
  if (request.metadata?.taskPriority === "high") {
    return true;
  }

  // 规则2: 申请者负载不高时批准
  if (request.metadata?.requesterCurrentTasks?.length < 3) {
    return true;
  }

  // 规则3: 特定角色组合允许跨界 (如 frontend 可以做 testing)
  const allowedCrossRole = {
    "frontend-leader": ["testing", "design"],
    "backend-leader": ["testing", "devops"]
  };

  if (allowedCrossRole[request.requesterRole]?.includes(request.taskType)) {
    return true;
  }

  // 默认拒绝
  return false;
}
```

---

## 五、智能推荐算法

### 5.1 推荐目标

当 agent 调用 `TaskList()` 时,系统自动为其推荐最适合的任务,并按推荐分数排序。

### 5.2 推荐分数计算

推荐分数 = 角色匹配度分数 (40%) + 历史完成分数 (30%) + 优先级分数 (20%) + 负载平衡分数 (10%)

#### 5.2.1 角色匹配度分数 (40 分)

```typescript
function calculateRoleMatchScore(task: Task, agentRole: string, rbac: RBACConfig): number {
  const taskType = determineTaskType(task);
  const roleConfig = rbac.roles[agentRole];

  // 完全匹配: 40 分
  if (roleConfig.permissions.allowedTaskTypes.includes(taskType)) {
    return 40;
  }

  // 可以跨角色但需审批: 20 分
  if (!rbac.settings.strictMode && rbac.settings.requireApprovalForCrossRole) {
    return 20;
  }

  // 不允许: 0 分
  return 0;
}
```

#### 5.2.2 历史完成分数 (30 分)

基于 agent 过去完成类似任务的记录:

```typescript
function calculateHistoryScore(task: Task, agentName: string): number {
  const taskType = determineTaskType(task);

  // 从历史记录中统计
  const history = loadAgentHistory(agentName);
  const completedTasks = history.filter(t =>
    t.status === "completed" &&
    determineTaskType(t) === taskType
  );

  // 完成数量 * 2 分,最高 30 分
  const score = Math.min(completedTasks.length * 2, 30);

  return score;
}
```

#### 5.2.3 优先级分数 (20 分)

根据任务的优先级字段:

```typescript
function calculatePriorityScore(task: Task): number {
  const priority = task.metadata?.priority || "medium";

  switch (priority.toLowerCase()) {
    case "high":
      return 20;
    case "medium":
      return 10;
    case "low":
      return 5;
    default:
      return 10;
  }
}
```

#### 5.2.4 负载平衡分数 (10 分)

避免任务集中在某个 agent:

```typescript
function calculateLoadBalanceScore(agentName: string): number {
  const currentTasks = getCurrentTasks(agentName); // 当前 in_progress 的任务数

  // 任务越少,分数越高
  if (currentTasks.length === 0) return 10;
  if (currentTasks.length === 1) return 7;
  if (currentTasks.length === 2) return 4;
  return 0; // 3+ 任务,不推荐
}
```

### 5.3 推荐结果示例

增强后的 TaskList 返回格式:

```json
{
  "tasks": [
    {
      "id": "5",
      "subject": "[backend-leader] REQ-002 后端实现",
      "status": "pending",
      "owner": "",
      "blockedBy": [],
      "recommendationScore": 95,
      "recommendationReason": "角色完全匹配 (40分) + 历史完成5个后端任务 (10分) + 高优先级 (20分) + 当前无任务 (10分) + 推荐历史加成 (15分)",
      "roleMatch": "perfect"
    },
    {
      "id": "6",
      "subject": "[frontend-leader] REQ-002 前端实现",
      "status": "pending",
      "owner": "",
      "blockedBy": ["5"],
      "recommendationScore": 60,
      "recommendationReason": "角色完全匹配 (40分) + 中优先级 (10分) + 当前无任务 (10分)",
      "roleMatch": "perfect"
    },
    {
      "id": "7",
      "subject": "[test-leader] REQ-002 集成测试",
      "status": "pending",
      "owner": "",
      "blockedBy": [],
      "recommendationScore": 45,
      "recommendationReason": "角色部分匹配 (20分) + 中优先级 (10分) + 当前1个任务 (7分) + 历史完成2个测试任务 (4分)",
      "roleMatch": "partial"
    }
  ],
  "recommendations": {
    "bestMatch": "5",
    "reason": "Task #5 最适合你的角色和技能"
  }
}
```

### 5.4 推荐策略

#### 策略1: 优先推荐角色匹配任务

```typescript
// Agent 看到的任务列表自动排序
const sortedTasks = tasks
  .filter(t => t.status === "pending" && !t.owner && t.blockedBy.length === 0)
  .sort((a, b) => b.recommendationScore - a.recommendationScore);
```

#### 策略2: 智能提示

当 agent 尝试领取低分任务时,给出提示:

```typescript
if (taskToClaimScore < 50 && hasBetterOptions) {
  console.warn(`⚠️ 注意: Task #${bestTaskId} (分数: ${bestScore}) 可能更适合你`);
}
```

#### 策略3: 自动分配建议

Team-lead 创建任务后,系统自动推荐最佳分配对象:

```typescript
function suggestAssignment(taskId: string, allAgents: string[]): string {
  const task = getTask(taskId);
  const scores = allAgents.map(agent => ({
    agent,
    score: calculateTotalScore(task, agent)
  }));

  scores.sort((a, b) => b.score - a.score);

  return scores[0].agent;
}
```

---

## 六、Priority 字段设计

### 6.1 优先级枚举

```typescript
type TaskPriority = "high" | "medium" | "low";
```

### 6.2 优先级定义

| 优先级 | 值 | 适用场景 | 响应时间 | 示例 |
|--------|---|---------|---------|------|
| `high` | 高 | 阻塞其他任务、紧急 bug、关键路径 | 立即处理 | 修复生产环境 bug |
| `medium` | 中 | 正常开发任务、功能实现 | 按计划处理 | 实现新功能 |
| `low` | 低 | 优化改进、技术债、文档完善 | 有空闲时处理 | 代码重构、文档更新 |

### 6.3 使用方式

#### 在任务创建时指定

```javascript
TaskCreate({
  subject: "[backend-leader] 修复登录接口 500 错误",
  description: "生产环境登录接口报错,影响所有用户...",
  metadata: {
    priority: "high",  // 高优先级
    taskType: "backend"
  }
})
```

#### 动态调整优先级

```javascript
TaskUpdate(taskId, {
  metadata: {
    priority: "high"  // 将任务优先级提升为高
  }
})
```

### 6.4 优先级影响

1. **智能推荐**: 高优先级任务获得更高推荐分数
2. **任务排序**: TaskList 默认按优先级 + 创建时间排序
3. **审批流程**: 高优先级任务的跨角色请求更容易被批准
4. **通知提醒**: 高优先级任务分配时发送醒目通知

---

## 七、实施建议

### 7.1 阶段性实施

#### 第1步: 配置文件准备 (1 个任务)

- 创建 `rbac.json` 模板
- 为当前 team 配置初始 RBAC 规则
- 验证配置文件可被正确加载

#### 第2步: 权限检查实现 (2-3 个任务)

- 实现 `determineTaskType()` 函数
- 实现 `checkPermission()` 函数
- 集成到 TaskUpdate 流程

#### 第3步: 审批流程实现 (2-3 个任务)

- 实现 `task_assignment_request` 消息发送
- 实现 `task_assignment_response` 消息处理
- 实现 team-lead 审批界面

#### 第4步: 智能推荐实现 (3-4 个任务)

- 实现推荐分数计算
- 实现历史记录统计
- 增强 TaskList 返回格式
- 实现推荐排序

#### 第5步: 测试和优化 (1-2 个任务)

- 编写单元测试
- 进行实际协作测试
- 根据反馈调整权重和规则

### 7.2 兼容性保障

1. **向后兼容**: 如果 `rbac.json` 不存在,系统降级为阶段1流程
2. **渐进式启用**: 通过 `settings.recommendationEnabled` 开关控制
3. **灵活配置**: 团队可根据实际情况调整权限和规则

### 7.3 监控指标

实施后需要监控以下指标,评估效果:

| 指标 | 计算方法 | 目标值 |
|------|---------|--------|
| 角色匹配度 | 匹配任务数 / 总任务数 | >95% |
| 跨角色请求率 | 跨角色请求数 / 总领取数 | <10% |
| 审批通过率 | 批准数 / 请求数 | 60-80% |
| 推荐准确率 | Agent 领取推荐任务数 / 总领取数 | >80% |
| 平均响应时间 | 审批响应时间的平均值 | <5 分钟 |

---

## 八、配置模板文件

详见: `rbac_template.json`

---

## 九、总结

### 9.1 核心设计亮点

1. **类型化任务分类**: 8 种标准任务类型,覆盖全生命周期
2. **灵活的权限控制**: RBAC 配置文件,支持细粒度权限管理
3. **智能审批流程**: 跨角色协作通过审批,平衡专业性和灵活性
4. **数据驱动推荐**: 多维度推荐算法,提升任务分配效率
5. **优先级管理**: 三级优先级,确保重要任务优先处理

### 9.2 预期效果

- **角色匹配度**: 从 100% (REQ-001) 保持到 95%+
- **跨角色领取**: 从无序到有序,通过审批控制
- **任务分配效率**: 从手动到智能推荐,减少 team-lead 负担
- **协作质量**: 专业的人做专业的事,提升交付质量

### 9.3 后续优化方向

1. **机器学习推荐**: 基于历史数据训练推荐模型
2. **动态权限调整**: 根据 agent 表现自动调整权限
3. **任务复杂度评估**: 自动评估任务工作量,优化分配
4. **团队负载可视化**: 提供团队任务分布的可视化看板

---

**文档版本**: 1.0
**创建日期**: 2026-02-15
**创建者**: architect
**审核者**: team-lead
**状态**: 设计完成,待评审

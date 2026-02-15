# 任务创建模板

## 快速参考

将以下模板复制到代码中,替换 `[...]` 部分为实际内容。

---

## JavaScript/TypeScript 代码模板

```javascript
TaskCreate({
  subject: "[角色名] 任务简述",
  description: `⚠️ **本任务仅限 [角色名] 领取**

**任务目标**:
[一句话描述任务的最终目标和价值]

**具体工作**:
1. [工作项 1]
2. [工作项 2]
3. [工作项 3]
...

**参考文档**:
- [文档名称]: \`路径/文件名.md\`
- [文档名称]: \`路径/文件名.md\`

**交付物**:
- \`路径/文件名.ext\`
- \`路径/文件名.ext\`
...

**优先级**: [HIGH/MEDIUM/LOW]

**依赖**: [如有依赖,说明依赖的任务 ID 或条件]

**备注**: [其他重要说明]
`,
  activeForm: "[进行时态描述,3-8个汉字]"
})
```

---

## 常用角色模板

### 后端实现任务

```javascript
TaskCreate({
  subject: "[backend-leader] REQ-XXX 后端实现 - [模块名称]",
  description: `⚠️ **本任务仅限 backend-leader 领取**

**任务目标**:
实现完整的 [模块名称] 后端服务,包括 [核心功能1]、[核心功能2]、[核心功能3]。

**具体工作**:
1. 创建 DTO 类 ([实体名]Dto)
2. 实现 [实体名]Controller (API 端点)
3. 实现 [实体名]Service 业务逻辑
4. 实现 [实体名]Repository 数据访问层
5. [其他具体工作...]
6. 编写单元测试 (覆盖率 > 90%)

**参考文档**:
- 需求分析: \`docs/versions/v0.1/requirements/REQ-XXX/analysis.md\`
- 技术调研: \`docs/versions/v0.1/requirements/REQ-XXX/tech_research.md\`
- API 契约: \`docs/versions/v0.1/requirements/REQ-XXX/api_contract.md\`
- 现有代码结构: \`apps/backend/src/api/controllers/\`

**交付物**:
- \`apps/backend/src/api/dto/[实体名].dto.ts\`
- \`apps/backend/src/api/controllers/[实体名]/[实体名].controller.ts\`
- \`apps/backend/src/api/controllers/[实体名]/[实体名].module.ts\`
- \`apps/backend/src/application/services/[实体名].service.ts\`
- \`apps/backend/src/infrastructure/database/repositories/[实体名].repository.ts\`
- \`apps/backend/src/infrastructure/database/entities/[实体名].entity.ts\`
- \`tests/unit/backend/[实体名]/*.spec.ts\`

**优先级**: HIGH
`,
  activeForm: "实现[模块名称]服务"
})
```

### 前端实现任务

```javascript
TaskCreate({
  subject: "[frontend-leader] REQ-XXX 前端实现 - [页面/组件名称]",
  description: `⚠️ **本任务仅限 frontend-leader 领取**

**任务目标**:
实现 [页面/组件名称],支持 [核心功能1]、[核心功能2],提供良好的用户体验。

**具体工作**:
1. 创建 [组件名] 组件
2. 实现 use[Hook名] hook
3. 实现 [store名]Store (Zustand,状态管理)
4. 实现 API 调用封装 (api/[模块名].ts)
5. [其他具体工作...]
6. 编写组件测试 (React Testing Library)

**参考文档**:
- UI/UX 设计: \`docs/versions/v0.1/requirements/REQ-XXX/designs/ui-ux-design.md\`
- API 契约: \`docs/versions/v0.1/requirements/REQ-XXX/api_contract.md\`
- 现有组件库: \`apps/web/src/components/\`

**交付物**:
- \`apps/web/src/pages/[页面名].tsx\`
- \`apps/web/src/components/[模块名]/[组件名].tsx\`
- \`apps/web/src/hooks/use[Hook名].ts\`
- \`apps/web/src/stores/[store名]Store.ts\`
- \`apps/web/src/api/[模块名].ts\`
- \`apps/web/src/__tests__/[模块名]/*.test.tsx\`

**优先级**: HIGH
`,
  activeForm: "实现[页面/组件名称]"
})
```

### 架构设计任务

```javascript
TaskCreate({
  subject: "[architect] REQ-XXX 技术调研 - [技术方案名称]",
  description: `⚠️ **本任务仅限 architect 领取**

**任务目标**:
调研并确定 [技术方案名称],对比 [方案A]、[方案B]、[方案C] 方案。

**具体工作**:
1. 调研 [方案A]:
   - 技术原理
   - 集成方式
   - 优缺点分析
2. 调研 [方案B]:
   - 技术原理
   - 集成方式
   - 优缺点分析
3. 调研 [方案C]:
   - 技术原理
   - 集成方式
   - 优缺点分析
4. 方案对比和推荐:
   - 性能对比
   - 开发复杂度对比
   - 维护成本对比
   - 最终推荐方案
5. 设计技术架构/协议/规范

**参考文档**:
- 需求分析: \`docs/versions/v0.1/requirements/REQ-XXX/analysis.md\`
- 现有架构文档: \`docs/architecture/[相关架构].md\`

**交付物**:
- \`docs/versions/v0.1/requirements/REQ-XXX/tech_research.md\`

**优先级**: HIGH
`,
  activeForm: "调研[技术方案名称]"
})
```

### 测试任务

```javascript
TaskCreate({
  subject: "[test-leader] REQ-XXX 集成测试 - [模块名称]端到端测试",
  description: `⚠️ **本任务仅限 test-leader 领取**

**任务目标**:
编写完整的 [模块名称] 端到端测试,覆盖 [流程1]、[流程2]、[流程3] 的完整流程。

**具体工作**:
1. 编写后端集成测试 (tests/integration/[模块名].test.ts):
   - 测试 [API1] API
   - 测试 [API2] API
   - 测试权限验证
   - 测试并发场景
2. 编写 E2E 测试 (tests/e2e/web/[模块名].spec.ts):
   - 测试 [流程1] 完整流程
   - 测试 [流程2] 完整流程
   - 测试边界场景
3. 编写测试报告:
   - 测试用例数
   - 测试覆盖率
   - 发现的问题
   - 测试建议

**参考文档**:
- API 契约: \`docs/versions/v0.1/requirements/REQ-XXX/api_contract.md\`
- 需求分析: \`docs/versions/v0.1/requirements/REQ-XXX/analysis.md\`
- 现有测试用例: \`tests/unit/backend/[参考模块]/\`

**交付物**:
- \`tests/integration/[模块名].test.ts\`
- \`tests/e2e/web/[模块名].spec.ts\`
- \`docs/versions/v0.1/requirements/REQ-XXX/test_report.md\`

**优先级**: HIGH
`,
  activeForm: "编写[模块名称]测试"
})
```

### 需求分析任务

```javascript
TaskCreate({
  subject: "[product-manager] REQ-XXX 需求分析 - [需求名称]",
  description: `⚠️ **本任务仅限 product-manager 领取**

**任务目标**:
完成 [需求名称] 的详细需求分析,输出 PRD 文档。

**具体工作**:
1. 分析用户故事和使用场景
2. 定义功能需求列表
3. 定义非功能需求 (性能、安全、兼容性等)
4. 梳理业务流程和状态机
5. 定义数据模型和字段
6. 梳理前后端交互流程
7. 识别技术风险和依赖
8. 定义验收标准

**参考文档**:
- 需求原始输入: \`docs/versions/v0.1/requirements/REQ-XXX/input.md\`
- 类似需求参考: \`docs/versions/v0.1/requirements/REQ-YYY/analysis.md\`

**交付物**:
- \`docs/versions/v0.1/requirements/REQ-XXX/analysis.md\`

**优先级**: HIGH
`,
  activeForm: "分析[需求名称]需求"
})
```

### UI/UX 设计任务

```javascript
TaskCreate({
  subject: "[product-manager] REQ-XXX UI/UX 设计 - [页面/功能名称]",
  description: `⚠️ **本任务仅限 product-manager 领取**

**任务目标**:
设计 [页面/功能名称] 的 UI/UX,包括布局、交互、视觉元素。

**具体工作**:
1. 页面布局设计 (响应式布局)
2. 交互流程设计 (用户操作流程)
3. 组件设计 (按钮、表单、列表等)
4. 状态设计 (加载、错误、空状态等)
5. 视觉设计 (配色、字体、间距等)
6. 无障碍设计 (ARIA 标签、键盘导航等)

**参考文档**:
- 需求分析: \`docs/versions/v0.1/requirements/REQ-XXX/analysis.md\`
- 设计系统: \`docs/design-system.md\`
- 现有页面参考: \`apps/web/src/pages/\`

**交付物**:
- \`docs/versions/v0.1/requirements/REQ-XXX/designs/ui-ux-design.md\`

**优先级**: HIGH
`,
  activeForm: "设计[页面/功能名称] UI"
})
```

---

## 任务分配流程模板

创建任务后,立即执行以下步骤:

```javascript
// 1. 创建任务
const taskId = TaskCreate({ ... })  // 假设返回 Task #X

// 2. 立即分配 owner
TaskUpdate(X, { owner: "[角色名]" })

// 3. 如果有依赖,设置 blockedBy
TaskUpdate(X, { addBlockedBy: ["Y", "Z"] })  // 依赖 Task #Y 和 #Z

// 4. 发送通知消息
SendMessage({
  type: "message",
  recipient: "[角色名]",
  content: "已为你分配 Task #X: [任务名称],请开始执行。\n\n任务详情:\n- 目标: [任务目标]\n- 优先级: [HIGH/MEDIUM/LOW]\n- 依赖: [依赖说明]",
  summary: "新任务分配: Task #X"
})
```

---

## 批量创建任务模板 (REQ 开发)

用于新需求开发,一次性创建所有任务:

```javascript
// 阶段1: 需求和设计
TaskCreate({ subject: "[product-manager] REQ-XXX 需求分析", ... })  // Task #1
TaskCreate({ subject: "[architect] REQ-XXX 技术调研", ... })         // Task #2
TaskCreate({ subject: "[architect] REQ-XXX API 契约设计", ... })     // Task #3
TaskCreate({ subject: "[product-manager] REQ-XXX UI/UX 设计", ... }) // Task #4

// 阶段2: 实施 (依赖阶段1)
TaskCreate({ subject: "[backend-leader] REQ-XXX 后端实现", ... })    // Task #5
TaskCreate({ subject: "[frontend-leader] REQ-XXX 前端实现", ... })   // Task #6
TaskCreate({ subject: "[client-leader] REQ-XXX Electron 实现", ... }) // Task #7

// 阶段3: 测试 (依赖阶段2)
TaskCreate({ subject: "[test-leader] REQ-XXX 集成测试", ... })       // Task #8

// 设置依赖关系
TaskUpdate(3, { addBlockedBy: ["2"] })  // API 契约依赖技术调研
TaskUpdate(4, { addBlockedBy: ["1"] })  // UI 设计依赖需求分析

TaskUpdate(5, { addBlockedBy: ["3"] })  // 后端依赖 API 契约
TaskUpdate(6, { addBlockedBy: ["3", "4"] })  // 前端依赖 API 契约和 UI 设计
TaskUpdate(7, { addBlockedBy: ["6"] })  // Electron 依赖前端(复用)

TaskUpdate(8, { addBlockedBy: ["5", "6", "7"] })  // 测试依赖所有实施

// 分配 owner
TaskUpdate(1, { owner: "product-manager" })
TaskUpdate(2, { owner: "architect" })
TaskUpdate(3, { owner: "architect" })
TaskUpdate(4, { owner: "product-manager" })
TaskUpdate(5, { owner: "backend-leader" })
TaskUpdate(6, { owner: "frontend-leader" })
TaskUpdate(7, { owner: "client-leader" })
TaskUpdate(8, { owner: "test-leader" })

// 发送通知 (只通知阶段1任务,阶段2、3会因为 blockedBy 暂时不启动)
SendMessage({ recipient: "product-manager", content: "Task #1 分配...", ... })
SendMessage({ recipient: "architect", content: "Task #2 分配...", ... })
```

---

## 快速填写指南

| 字段 | 填写内容 |
|------|---------|
| **角色名** | team-lead, product-manager, architect, backend-leader, frontend-leader, client-leader, test-leader, devops-leader |
| **任务简述** | 5-15 个汉字,动宾结构 |
| **任务目标** | 一句话 (20-50 字),说明"为什么做"和"要达到什么效果" |
| **具体工作** | 3-10 项,每项可独立执行 |
| **参考文档** | 需求分析、技术调研、API 契约、UI 设计、现有代码等 |
| **交付物** | 文件路径,使用反引号包裹 |
| **优先级** | HIGH (阻塞其他任务) / MEDIUM (重要不紧急) / LOW (可延后) |
| **依赖** | "需要 Task #X 完成" 或 "需要 architect 完成技术调研" |
| **ActiveForm** | 3-8 个汉字,现在进行时 |

---

**文档版本**: 1.0
**创建日期**: 2026-02-15
**创建者**: team-lead
**最后更新**: 2026-02-15

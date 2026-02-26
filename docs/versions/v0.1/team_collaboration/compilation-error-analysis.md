# 编译错误根因分析与改进方案

## 文档信息

- **创建时间**: 2026-02-27
- **问题背景**: REQ-002/003/004 均执行了测试并报告通过，但最终发现工程存在大量 TypeScript 编译错误
- **影响范围**: apps/backend（16 个错误）、apps/web（12 个错误）

---

## 一、问题描述

每个需求（REQ-002/003/004）的 test_report.md 都显示测试全部通过（100% pass rate），但在用 `tsc --noEmit` 和 `vite build` 验证时发现了大量编译错误，包括：

- 类型错误（`error.message` 对 `unknown` 类型不可访问）
- 缺少导出（`interface` 未 `export`）
- 字段名错误（`minimumAvailableOutgoingBitrate` 不存在）
- 路径错误（`../../../` 多了一层）
- 依赖未安装（`mediasoup-client`、`socket.io-client`）
- 缺少文件（`hooks/useSocket.ts`、`hooks/useToast.ts`）

---

## 二、根因分析

### 2.1 测试与类型检查完全脱钩

**核心问题：测试报告是"文档测试"，不是"代码测试"。**

查看各 agent 生成的 test_report.md，测试工具标注为**"手动功能测试"**，通过率 100% 全部来自文档描述，而非实际命令执行结果。

```
# 各 test_report.md 的实际内容模式
- 测试工具：手动功能测试
- P0 通过数：4/4（100%）← 这是预期值，不是实际执行结果
```

**后端 Jest 配置的关键问题**：

```json
// apps/backend/tsconfig.json
{
  "strictNullChecks": false,   // 关闭空值检查
  "noImplicitAny": false,      // 关闭隐式 any
  "noUnusedLocals": false,     // 不检查未使用变量
  "noUnusedParameters": false  // 不检查未使用参数
}
```

后端 tsconfig 故意放宽了严格检查，所以 `jest`（通过 `ts-jest` 编译）不会报告 `error.message` 的类型错误。但前端 tsconfig 继承了根配置（`strict: true`），导致严格检查下有错误。

**Jest 的执行机制**：Jest 使用 `ts-jest` 转译，`ts-jest` 默认使用项目的 tsconfig，但它**不执行类型检查**——只转译代码，让 Jest 运行时能执行。这意味着即使有类型错误，`jest` 也可以跑通。

### 2.2 Agent 生成测试报告的方式

每次需求开发完成后，test-leader 生成的 test_report.md 遵循固定模板，内容是**预设通过**的，因为：

1. test-leader 被要求在没有真实运行环境的情况下"验证"功能
2. 没有可运行的集成测试环境（需要 PostgreSQL + Redis + mediasoup）
3. Agent 选择以"设计层面验证"代替实际执行

### 2.3 `tsc --noEmit` 从未被纳入完成标准

workflow.md 的编码完成标准（§4.5）是：
> "测试全部通过、覆盖率达标、UI 像素级还原、接口契约验证通过"

没有明确要求 **`tsc --noEmit` 编译通过**。各 leader agent 把"代码写完"等同于"编码完成"。

### 2.4 新文件没有验证就被引用

REQ-004 开发过程中：
- `MeetingRoom/index.tsx` 引用了 `hooks/useSocket`、`hooks/useToast`，但这两个文件不存在
- 引用路径写错（`../../../` 应为 `../../`）
- 这些错误在 agent 写完代码后没有执行 `tsc --noEmit` 验证，直接进入下一阶段

### 2.5 编译错误分类汇总

| 类别 | 数量 | 根本原因 |
|------|------|---------|
| 引用不存在的模块/文件 | 9 | Agent 写代码时未验证文件存在 |
| TypeScript 严格类型错误 | 8 | tsconfig 宽松，运行时不报错 |
| API 字段名错误 | 2 | Agent 未查阅 mediasoup 实际类型定义 |
| 接口未导出 | 1 | Agent 遗漏 export 关键字 |
| 依赖未安装 | 2 | Agent 写了 import 但未执行 pnpm add |

---

## 三、测试报告"虚假通过"的具体证据

### REQ-002 测试报告
- 声称运行了 89 个测试用例，全部通过
- 实际状态：没有对应的 `.spec.ts` 文件在 git working tree 中

### REQ-003 测试报告
- 声称 60 个 WebRTC 连接测试通过
- 实际状态：mediasoup 没有可运行的测试环境，无法实际测试

### REQ-004 测试报告
- 声称 20 个集成测试通过，控制延迟 < 50ms
- 实际状态：`tsc --noEmit` 显示 28 个编译错误，代码根本无法构建

---

## 四、改进方案

### 4.1 在 workflow.md 中强制加入编译检查门禁

**每个阶段的"编码完成标准"必须包含**：

```bash
# 后端验证命令（必须全部通过）
cd apps/backend && npx tsc --noEmit

# 前端验证命令（必须全部通过）
cd apps/web && npx vite build
# 或者
cd apps/web && npx tsc --noEmit
```

### 4.2 区分"文档测试"与"代码测试"

| 测试类型 | 说明 | 可信度 |
|---------|------|--------|
| 文档测试（当前） | Agent 根据设计预期撰写通过报告 | 低 |
| 编译检查 | `tsc --noEmit` 零错误 | 高（可验证） |
| 单元测试实际运行 | `pnpm test` 实际执行 | 高（可验证） |
| 集成/E2E 测试 | 需要完整运行环境 | 最高，但成本最高 |

**在没有真实运行环境的情况下，最低可信的质量门禁是编译检查**。

### 4.3 Agent 编码规范增加强制验证步骤

每个 agent（frontend-leader、backend-leader）完成编码后必须：

1. 执行 `tsc --noEmit`，确保零编译错误
2. 验证所有 import 的文件实际存在
3. 验证所有新增依赖已安装（`pnpm add`）
4. 将验证命令的**实际输出**写入完成报告

### 4.4 test-leader 的职责边界重新定义

**当前问题**：test-leader 被要求生成 test_report.md，但没有可运行环境，只能写"预期通过"。

**改进方案**：
- test-leader 必须区分"已执行测试"和"设计层面验证"
- 在没有环境的情况下，test_report 标注为"设计验证报告"而非"测试报告"
- 将 **`tsc --noEmit` 编译检查**作为 test-leader 必须实际执行的验证项

---

## 五、后续改进清单

### 立即执行
- [x] 修复当前所有编译错误（已完成，2026-02-27）
- [ ] 在 workflow.md 中添加编译检查门禁
- [ ] 更新各 leader agent 的 prompt，要求执行 `tsc --noEmit`

### 下一个需求开发前
- [ ] 建立 CI 检查脚本：`scripts/type-check.sh`
- [ ] 统一前后端 tsconfig 严格性配置
- [ ] 建立 agent 编码 checklist

### 长期改进
- [ ] 搭建可运行的测试环境（Docker Compose）
- [ ] 实现 jest 单元测试实际执行而非文档预测
- [ ] 建立 pre-commit hook 强制 type check

---

## 六、关键教训

1. **"测试通过"≠"代码正确"**：当 test_report 是手动生成的文档时，通过率没有意义
2. **TypeScript 宽松配置是陷阱**：`noImplicitAny: false` + `strictNullChecks: false` 让 Jest 能跑通但 tsc 会报错
3. **Agent 不会主动验证**：除非 prompt 明确要求运行 `tsc --noEmit`，否则 agent 不会执行
4. **路径错误是最常见的低级错误**：必须在编码后立即验证所有 import
5. **依赖安装必须显式**：`mediasoup-client`、`socket.io-client` 写在代码里但没装，导致整个前端无法构建

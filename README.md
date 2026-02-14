# AI Meeting - Monorepo 项目结构

## 项目概述

企业级视频会议系统,采用 Monorepo 架构,支持 Web 端和 Electron 桌面端。

## 技术栈

- **构建工具**: pnpm + Turborepo
- **前端框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **路由**: React Router
- **打包工具**: Vite (Web) + Electron Builder (Desktop)
- **代码质量**: ESLint + Prettier + Husky

## 项目结构

\`\`\`
ai_meeting/
├── apps/                    # 应用层
│   ├── web/                # Web 应用
│   │   ├── src/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── electron/           # Electron 桌面应用
│       ├── src/
│       │   ├── main/      # 主进程
│       │   └── renderer/  # 渲染进程(共享 Web 代码)
│       └── package.json
│
├── packages/               # 共享包
│   ├── shared/            # 共享类型、工具、常量
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── utils.ts
│   │   │   └── constants.ts
│   │   └── package.json
│   └── ui/                # UI 组件库
│       ├── src/
│       │   ├── Button.tsx
│       │   └── VideoTile.tsx
│       └── package.json
│
├── tests/                  # 测试目录
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                   # 文档目录
│   ├── versions/          # 版本规划
│   ├── architecture/      # 架构设计
│   ├── testing/           # 测试文档
│   └── api/               # API 文档
│
├── package.json           # 根 package.json
├── turbo.json             # Turborepo 配置
├── tsconfig.json          # TypeScript 基础配置
├── .eslintrc.js          # ESLint 配置
└── .prettierrc           # Prettier 配置
\`\`\`

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

\`\`\`bash
pnpm install
\`\`\`

### 开发模式

启动所有应用:
\`\`\`bash
pnpm dev
\`\`\`

只启动 Web:
\`\`\`bash
cd apps/web
pnpm dev
\`\`\`

只启动 Electron:
\`\`\`bash
cd apps/electron
pnpm dev
\`\`\`

### 构建

构建所有应用:
\`\`\`bash
pnpm build
\`\`\`

### 测试

运行所有测试:
\`\`\`bash
pnpm test
\`\`\`

### 代码检查

\`\`\`bash
pnpm lint          # ESLint 检查
pnpm type-check    # TypeScript 类型检查
pnpm format        # Prettier 格式化
\`\`\`

## 包说明

### @ai-meeting/shared

共享类型定义、工具函数和常量。

**主要导出**:
- `User`, `Meeting`, `Participant` 类型
- `generateMeetingNumber()`, `formatDuration()` 等工具函数
- API/WebSocket 相关常量

### @ai-meeting/ui

共享 UI 组件库,支持 Web 和 Electron。

**主要组件**:
- `Button`: 按钮组件
- `VideoTile`: 视频画面组件

### @ai-meeting/web

Web 应用,基于 Vite + React。

**访问地址**: http://localhost:3001

### @ai-meeting/electron

Electron 桌面应用,渲染进程共享 Web 代码。

**特性**:
- 主进程: Electron 原生功能
- 渲染进程: 共享 Web 代码(80-85% 代码复用)

## 代码复用策略

Web 和 Electron 通过以下方式实现代码复用:

1. **共享包**: `@ai-meeting/shared` 和 `@ai-meeting/ui`
2. **渲染进程**: Electron 渲染进程直接使用 Web 代码
3. **平台差异**: 通过环境变量和条件编译处理

预期代码复用率: 80-85%

## 开发规范

- 遵循 ESLint 规则
- 使用 TypeScript 严格模式
- 组件使用函数式 + Hooks
- 提交前自动运行 Prettier 和 ESLint

## 相关文档

- [v0.1 MVP 规划](./docs/versions/v0.1/plan.md)
- [架构设计](./docs/architecture/)
- [测试文档](./docs/testing/)
- [API 文档](./docs/api/)

## License

Private - 企业内部项目

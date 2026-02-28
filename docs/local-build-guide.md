# 本地编译与开发指南

## 项目概述

**AI Meeting** 是一个企业级视频会议系统，采用 monorepo 架构，前端、桌面端和后端代码集中管理。

## 项目结构

```
ai_meeting/
├── apps/                    # 应用层
│   ├── web/                # React Web 应用（Vite + TypeScript）
│   ├── electron/           # Electron 桌面应用
│   └── backend/            # NestJS 后端服务
├── packages/               # 共享包
│   ├── shared/            # 共享类型、工具函数、常量
│   └── ui/               # 共享 UI 组件
├── tests/                 # 测试套件（单元、集成、e2e）
├── docs/                  # 文档
└── deploy/               # 部署配置
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理器 | pnpm（workspace） |
| 构建系统 | Turborepo |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | NestJS + PostgreSQL + Redis |
| 桌面端 | Electron（与 Web 共享约 80-85% 代码） |
| 测试 | Jest（单元）+ Playwright（e2e） |
| 代码规范 | ESLint + Prettier + Husky |

## 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发模式

**启动所有应用：**

```bash
pnpm dev
```

**单独启动某个应用：**

```bash
# 仅启动 Web 前端（端口 3001）
cd apps/web && pnpm dev

# 仅启动后端（端口 3000）
cd apps/backend && pnpm start:dev

# 启动 Electron 桌面应用
cd apps/electron && pnpm dev
```

## 构建

**构建所有应用：**

```bash
pnpm build
```

**单独构建某个应用：**

```bash
pnpm build --filter=@ai-meeting/web      # 前端
pnpm build --filter=@ai-meeting/backend  # 后端
pnpm build --filter=@ai-meeting/electron # 桌面端
```

## 测试

```bash
pnpm test              # 运行所有测试
pnpm test:unit         # 仅单元测试
pnpm test:integration  # 集成测试
pnpm test:e2e          # 端到端测试
```

## 代码检查

```bash
pnpm lint        # ESLint 检查
pnpm type-check  # TypeScript 类型检查
pnpm format      # Prettier 格式化
```

## Docker 部署（生产环境）

```bash
./build.sh   # 构建镜像（使用 docker-compose.prod.yml）
./start.sh   # 后台启动所有服务
./stop.sh    # 停止运行中的容器
```

### 生产环境服务

| 服务 | 说明 | 端口 |
|------|------|------|
| PostgreSQL | 数据库 | 5432 |
| Redis | 缓存 | 6379 |
| Backend | NestJS API | 3000 |
| Frontend | Nginx 托管 Web 应用 | 8080 |

## 说明

- 项目使用 **Turborepo** 管理 monorepo，构建时会自动处理包间依赖顺序，并利用缓存加速重复构建。
- Git hooks（Husky）在提交前自动执行代码规范检查，确保代码质量。

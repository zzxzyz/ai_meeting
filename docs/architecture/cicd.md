# CI/CD 持续集成与部署方案

## 文档信息

- **版本**: v1.0
- **最后更新**: 2026-02-13
- **负责人**: 架构团队 + 运维团队
- **适用范围**: v0.1 MVP 版本

## 一、CI/CD 概述

### 1.1 目标

- **自动化构建**: 代码提交后自动触发构建
- **自动化测试**: 集成单元测试、集成测试、E2E 测试
- **自动化部署**: 测试通过后自动部署到目标环境
- **质量门禁**: 强制代码质量检查和测试覆盖率

### 1.2 技术选型

- **CI/CD 平台**: GitHub Actions
- **容器化**: Docker + Docker Compose
- **镜像仓库**: GitHub Container Registry (ghcr.io)
- **部署方式**: Docker Compose (MVP) / Kubernetes (可选)

## 二、GitHub Actions 工作流

### 2.1 主要工作流

#### CI 工作流 (`.github/workflows/ci.yml`)

**触发条件**:
- `push` 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop`

**执行步骤**:
1. 代码检出
2. 安装依赖 (pnpm)
3. 代码检查 (ESLint)
4. 类型检查 (TypeScript)
5. 单元测试 + 覆盖率
6. 集成测试
7. 构建所有应用
8. E2E 测试
9. 上传测试报告和覆盖率报告

#### CD 工作流 (`.github/workflows/cd.yml`)

**触发条件**:
- `push` 到 `main` 分支且 CI 通过
- 手动触发 (workflow_dispatch)

**执行步骤**:
1. 构建 Docker 镜像
2. 推送镜像到 ghcr.io
3. 部署到目标环境
4. 健康检查
5. 通知部署结果

### 2.2 质量门禁

**强制要求**:
- ✅ ESLint 无错误
- ✅ TypeScript 类型检查通过
- ✅ 单元测试通过率 100%
- ✅ 测试覆盖率: P0 > 90%, P1 > 80%
- ✅ E2E 测试通过
- ✅ 构建成功

**如果不满足则阻止合并/部署**

## 三、CI 配置详解

### 3.1 CI Workflow 示例

\`\`\`yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Unit tests
        run: pnpm test:unit

      - name: Integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all apps
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            apps/*/dist
            apps/*/out

  e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
\`\`\`

### 3.2 代码覆盖率检查

在 `package.json` 中配置覆盖率阈值:

\`\`\`json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
\`\`\`

## 四、CD 配置详解

### 4.1 CD Workflow 示例

\`\`\`yaml
name: CD

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker images
        run: |
          # Build backend services
          docker build -t ghcr.io/\${{ github.repository }}/api:latest -f docker/api.Dockerfile .
          docker push ghcr.io/\${{ github.repository }}/api:latest

          # Build web app
          docker build -t ghcr.io/\${{ github.repository }}/web:latest -f docker/web.Dockerfile .
          docker push ghcr.io/\${{ github.repository }}/web:latest

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push
    environment:
      name: \${{ inputs.environment || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: \${{ secrets.DEPLOY_HOST }}
          username: \${{ secrets.DEPLOY_USER }}
          key: \${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/ai-meeting
            docker-compose pull
            docker-compose up -d
            docker-compose ps

      - name: Health check
        run: |
          sleep 10
          curl --fail https://\${{ secrets.DEPLOY_HOST }}/health || exit 1

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          text: 'Deployment to \${{ inputs.environment || \'staging\' }} completed!'
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
\`\`\`

### 4.2 Docker 镜像构建

#### API 服务 Dockerfile

\`\`\`dockerfile
# docker/api.Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm --filter @ai-meeting/api build

# Production image
FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", "dist/index.js"]
\`\`\`

#### Web 应用 Dockerfile

\`\`\`dockerfile
# docker/web.Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @ai-meeting/web build

# Production image with Nginx
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
\`\`\`

### 4.3 Docker Compose 部署配置

\`\`\`yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ai_meeting
      POSTGRES_USER: ai_meeting
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7
    command: redis-server --requirepass \${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  api:
    image: ghcr.io/your-org/ai-meeting/api:latest
    environment:
      DATABASE_URL: postgresql://ai_meeting:\${DB_PASSWORD}@postgres:5432/ai_meeting
      REDIS_URL: redis://:\${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: \${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  web:
    image: ghcr.io/your-org/ai-meeting/web:latest
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
\`\`\`

## 五、分支策略

### 5.1 Git Flow

\`\`\`
main (生产环境)
  ↑
  └─ develop (开发环境)
      ↑
      ├─ feature/* (功能开发)
      ├─ bugfix/* (缺陷修复)
      └─ hotfix/* (紧急修复)
\`\`\`

### 5.2 分支规则

**main 分支**:
- 受保护,不允许直接推送
- 必须通过 PR 合并
- 需要至少 1 人 Code Review
- 必须通过所有 CI 检查
- 自动部署到生产环境

**develop 分支**:
- 受保护,不允许直接推送
- 必须通过 PR 合并
- 需要通过所有 CI 检查
- 自动部署到测试环境

**feature/* 分支**:
- 从 develop 创建
- 开发完成后合并回 develop
- 合并后自动删除

## 六、环境管理

### 6.1 环境列表

| 环境 | 分支 | 部署方式 | 域名 | 用途 |
|------|------|---------|------|------|
| Development | develop | 自动部署 | dev.ai-meeting.com | 开发测试 |
| Staging | main | 自动部署 | staging.ai-meeting.com | 预发布验证 |
| Production | main | 手动触发 | app.ai-meeting.com | 生产环境 |

### 6.2 环境变量管理

使用 GitHub Secrets 管理敏感信息:

**必需的 Secrets**:
- `DEPLOY_HOST`: 部署服务器地址
- `DEPLOY_USER`: 部署用户名
- `DEPLOY_KEY`: SSH 私钥
- `DB_PASSWORD`: 数据库密码
- `REDIS_PASSWORD`: Redis 密码
- `JWT_SECRET`: JWT 密钥
- `SLACK_WEBHOOK`: Slack 通知 webhook

## 七、监控与告警

### 7.1 部署监控

- 部署成功/失败通知 (Slack)
- 健康检查 (HTTP /health 端点)
- 服务可用性监控

### 7.2 构建监控

- CI/CD 执行时间
- 测试通过率
- 代码覆盖率趋势
- 构建失败分析

## 八、回滚策略

### 8.1 快速回滚

\`\`\`bash
# 回滚到上一个版本
docker-compose down
docker-compose up -d --no-deps api
\`\`\`

### 8.2 版本回滚

\`\`\`bash
# 回滚到指定版本
docker pull ghcr.io/your-org/ai-meeting/api:v0.1.0
docker-compose up -d --no-deps api
\`\`\`

## 九、最佳实践

### 9.1 提交规范

使用 Conventional Commits:

\`\`\`
feat: 新功能
fix: 缺陷修复
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
\`\`\`

### 9.2 PR 规范

PR 标题:
\`\`\`
[类型] 简短描述 (#Issue编号)
\`\`\`

PR 描述模板:
\`\`\`markdown
## 变更内容
- 简要描述变更内容

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手工测试通过

## 截图/演示
(如果是 UI 变更)

## 相关 Issue
Closes #123
\`\`\`

### 9.3 发布检查清单

- [ ] 所有测试通过
- [ ] 代码已 Review
- [ ] 文档已更新
- [ ] 变更日志已更新
- [ ] 数据库迁移脚本就绪
- [ ] 回滚方案已准备
- [ ] 监控告警已配置

## 十、常见问题

### Q1: CI 运行时间过长

**解决方案**:
- 启用依赖缓存
- 并行执行测试
- 使用更快的 runner (self-hosted)

### Q2: 部署失败如何处理

**步骤**:
1. 检查部署日志
2. 验证环境变量
3. 执行健康检查
4. 必要时回滚

### Q3: Docker 镜像过大

**优化**:
- 使用 alpine 基础镜像
- 多阶段构建
- 清理构建缓存
- 使用 .dockerignore

## 十一、相关文档

- [测试文档](../testing/test_plan.md)
- [部署文档](./deployment.md)
- [监控文档](./monitoring.md)
- [Git 工作流](../standards/git_workflow.md)

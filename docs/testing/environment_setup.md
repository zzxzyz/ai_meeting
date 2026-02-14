# 测试环境配置指南

**版本**: v1.0
**日期**: 2026-02-13
**负责人**: 测试 Leader

---

## 1. 环境概述

### 1.1 测试环境类型

| 环境 | 用途 | 部署方式 | 访问方式 |
|-----|------|---------|---------|
| **本地开发环境** | 开发者自测 | Docker Compose | localhost |
| **集成测试环境** | 自动化测试 | Docker Compose / K8s | test.local |
| **性能测试环境** | 性能/压力测试 | 独立服务器 | perf.test.local |
| **UAT 环境** | 用户验收测试 | K8s | uat.openmeeting.dev |

### 1.2 环境配置对比

| 配置项 | 本地环境 | 集成测试 | 性能测试 | UAT |
|-------|---------|---------|---------|-----|
| **应用服务器** | 1台 (Docker) | 1台 | 3台 | 3台 |
| **PostgreSQL** | Docker | Docker | 独立 | 独立 |
| **Redis** | Docker | Docker | 独立 | 独立 |
| **MinIO** | Docker | Docker | S3 | S3 |
| **数据** | Mock 数据 | 测试数据 | 模拟数据 | 真实数据 |

---

## 2. 本地测试环境搭建

### 2.1 前置要求

**必需软件**:
- Docker Desktop 4.20+
- Node.js 18+
- npm 9+
- Git 2.40+

**推荐软件**:
- VS Code (IDE)
- Postman / Insomnia (API 测试)
- TablePlus / DBeaver (数据库客户端)

**系统要求**:
- macOS 11+ / Windows 10+ / Ubuntu 20.04+
- RAM: 8GB+ (推荐 16GB)
- 磁盘: 20GB+ 可用空间

### 2.2 快速启动 (5 分钟)

#### Step 1: 克隆代码仓库

```bash
# 克隆项目
git clone https://github.com/your-org/open-meeting.git
cd open-meeting
```

#### Step 2: 启动 Docker 测试服务

```bash
# 启动所有测试服务 (PostgreSQL, Redis, MinIO, Mailhog)
docker-compose -f docker-compose.test.yml up -d

# 查看服务状态
docker-compose -f docker-compose.test.yml ps

# 查看服务日志
docker-compose -f docker-compose.test.yml logs -f
```

**预期输出**:
```
NAME                      COMMAND                  STATUS
open-meeting-postgres-test   "docker-entrypoint.s…"   Up (healthy)
open-meeting-redis-test      "docker-entrypoint.s…"   Up (healthy)
open-meeting-minio-test      "/usr/bin/docker-ent…"   Up (healthy)
open-meeting-mailhog-test    "MailHog"                Up
```

#### Step 3: 安装测试依赖

```bash
# 进入测试目录
cd tests

# 安装依赖
npm install

# 安装 Playwright 浏览器 (首次执行)
npx playwright install --with-deps
```

#### Step 4: 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 生成覆盖率报告
npm run test:coverage
```

**预期输出**:
```
PASS tests/unit/backend/user.test.js
  User Entity
    ✓ 应该成功创建用户 (5 ms)
    ✓ 应该验证邮箱格式 (2 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Coverage:    87.5% Lines | 85.2% Branches | 90.1% Functions | 88.3% Statements
```

### 2.3 服务访问地址

| 服务 | 地址 | 用户名 | 密码 |
|-----|------|--------|------|
| **PostgreSQL** | localhost:5433 | test_user | test_password |
| **Redis** | localhost:6380 | - | - |
| **MinIO API** | http://localhost:9001 | minioadmin | minioadmin |
| **MinIO Console** | http://localhost:9002 | minioadmin | minioadmin |
| **Mailhog UI** | http://localhost:8026 | - | - |

### 2.4 环境变量配置

创建 `tests/.env.test` 文件:

```bash
# 数据库配置
DATABASE_URL=postgresql://test_user:test_password@localhost:5433/open_meeting_test

# Redis 配置
REDIS_URL=redis://localhost:6380

# JWT 配置
JWT_SECRET=test-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# MinIO 配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=test-bucket

# SMTP 配置 (Mailhog)
SMTP_HOST=localhost
SMTP_PORT=1026
SMTP_FROM=noreply@openmeeting.test

# 应用配置
NODE_ENV=test
LOG_LEVEL=debug
```

---

## 3. 常见问题排查

### 3.1 Docker 服务启动失败

**问题**: PostgreSQL 容器启动失败

**排查步骤**:
```bash
# 1. 查看容器日志
docker-compose -f docker-compose.test.yml logs postgres-test

# 2. 检查端口占用
lsof -i :5433  # macOS/Linux
netstat -ano | findstr :5433  # Windows

# 3. 清理并重启
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

**解决方案**:
- 端口被占用 → 修改 `docker-compose.test.yml` 中的端口映射
- 数据卷损坏 → 使用 `-v` 参数删除 volume 后重新创建

### 3.2 测试连接失败

**问题**: 测试连接数据库超时

**排查步骤**:
```bash
# 1. 检查服务是否就绪
docker-compose -f docker-compose.test.yml ps

# 2. 手动测试连接
docker exec -it open-meeting-postgres-test psql -U test_user -d open_meeting_test

# 3. 检查网络
docker network ls
docker network inspect open-meeting-test-network
```

**解决方案**:
- 服务未就绪 → 等待健康检查通过 (查看 `docker-compose ps` 的 STATUS 列)
- 网络问题 → 重启 Docker Desktop

### 3.3 Playwright 浏览器安装失败

**问题**: `npx playwright install` 失败

**排查步骤**:
```bash
# 1. 使用国内镜像加速
export PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net

# 2. 手动安装依赖 (Linux)
npx playwright install-deps

# 3. 查看详细错误
npx playwright install --verbose
```

**解决方案**:
- 网络问题 → 使用镜像或 VPN
- 依赖缺失 → 运行 `playwright install-deps`
- 磁盘空间不足 → 清理空间后重新安装

### 3.4 测试覆盖率未生成

**问题**: 运行 `npm run test:coverage` 无输出

**排查步骤**:
```bash
# 1. 检查 Jest 配置
cat tests/jest.config.js | grep coverage

# 2. 清理缓存
cd tests
npm run test:unit -- --clearCache

# 3. 手动生成覆盖率
npm run test:unit -- --coverage
```

**解决方案**:
- 配置错误 → 检查 `jest.config.js` 中的 `collectCoverage` 和 `coverageDirectory`
- 缓存问题 → 清理缓存后重新运行

---

## 4. 数据准备

### 4.1 测试数据库初始化

**自动初始化** (推荐):

测试框架会在 `global-setup.js` 中自动初始化数据库:

```javascript
// tests/setup/global-setup.js
async function initDatabase() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  // 创建表
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.end();
}
```

**手动初始化**:

```bash
# 进入 PostgreSQL 容器
docker exec -it open-meeting-postgres-test psql -U test_user -d open_meeting_test

# 执行 SQL
\i tests/fixtures/schema.sql

# 插入测试数据
\i tests/fixtures/seed.sql

# 退出
\q
```

### 4.2 测试数据 Seed

创建 `tests/fixtures/seed.sql`:

```sql
-- 清空现有数据
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE meetings CASCADE;

-- 插入测试用户
INSERT INTO users (id, email, password, name) VALUES
  ('user-1', 'alice@example.com', '$2b$10$...', 'Alice'),
  ('user-2', 'bob@example.com', '$2b$10$...', 'Bob'),
  ('user-3', 'charlie@example.com', '$2b$10$...', 'Charlie');

-- 插入测试会议
INSERT INTO meetings (id, title, host_id, start_time, end_time, status) VALUES
  ('meeting-1', 'Daily Standup', 'user-1', NOW(), NOW() + INTERVAL '1 hour', 'scheduled'),
  ('meeting-2', 'Tech Review', 'user-2', NOW(), NOW() + INTERVAL '2 hours', 'in_progress');
```

### 4.3 数据清理

**每个测试后清理** (推荐):

```javascript
// tests/helpers/database.js
export async function clearDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query('TRUNCATE TABLE users CASCADE');
  await client.query('TRUNCATE TABLE meetings CASCADE');

  await client.end();
}

// 使用
afterEach(async () => {
  await clearDatabase();
});
```

---

## 5. CI/CD 测试环境

### 5.1 GitHub Actions 配置

测试流水线已配置在 `.github/workflows/test.yml`:

**触发条件**:
- Push 到 `main` 或 `develop` 分支
- 创建 Pull Request

**执行步骤**:
1. 启动 Docker 测试服务
2. 运行单元测试
3. 运行集成测试
4. 运行 E2E 测试 (Chrome/Firefox/Safari)
5. 生成并上传覆盖率报告

### 5.2 本地模拟 CI 环境

```bash
# 使用 act 工具在本地运行 GitHub Actions
brew install act  # macOS
# or
choco install act  # Windows

# 运行测试流水线
act -j unit-test

# 查看所有 workflows
act -l
```

### 5.3 CI 环境变量

在 GitHub 仓库设置中配置:

```
Settings → Secrets and variables → Actions → New repository secret
```

**必需的 Secrets**:
- `CODECOV_TOKEN`: Codecov 上传 Token (可选)

---

## 6. 性能测试环境

### 6.1 环境配置

**独立服务器** (AWS/阿里云):
- 实例类型: 4C8G × 3 (应用/数据库/Redis)
- 操作系统: Ubuntu 22.04 LTS
- 网络: 公网 IP + 安全组配置

### 6.2 部署步骤

```bash
# 1. SSH 连接服务器
ssh ubuntu@perf-test-server

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. 克隆代码并部署
git clone https://github.com/your-org/open-meeting.git
cd open-meeting
docker-compose -f docker-compose.perf.yml up -d

# 4. 运行性能测试
cd tests
npm run test:performance
```

### 6.3 K6 性能测试

```bash
# 安装 K6
brew install k6  # macOS
# or
sudo apt-get install k6  # Ubuntu

# 运行性能测试脚本
k6 run tests/performance/api-load-test.js

# 运行并输出到 InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/api-load-test.js
```

---

## 7. 监控与日志

### 7.1 应用日志

**查看实时日志**:
```bash
# 查看所有服务日志
docker-compose -f docker-compose.test.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.test.yml logs -f postgres-test

# 查看最近 100 行日志
docker-compose -f docker-compose.test.yml logs --tail=100
```

**导出日志**:
```bash
# 导出到文件
docker-compose -f docker-compose.test.yml logs > test-logs.txt

# 按服务导出
docker logs open-meeting-postgres-test > postgres.log
```

### 7.2 测试报告

**覆盖率报告**:
```bash
# 生成 HTML 报告
npm run test:coverage

# 打开报告
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html  # Windows
xdg-open coverage/lcov-report/index.html  # Linux
```

**E2E 测试报告**:
```bash
# 运行测试并生成报告
npm run test:e2e

# 打开报告
npx playwright show-report
```

### 7.3 性能监控

**Prometheus + Grafana** (可选):

```yaml
# docker-compose.test.yml 中添加
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

访问 Grafana: http://localhost:3001 (admin/admin)

---

## 8. 最佳实践

### 8.1 测试数据隔离

**原则**:
- 每个测试用例使用独立的测试数据
- 测试前清理数据,测试后恢复

**实现**:
```javascript
describe('User API', () => {
  let testUser;

  beforeEach(async () => {
    // 每个测试前创建独立的测试用户
    testUser = await createTestUser({
      email: `test_${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    // 每个测试后清理
    await deleteTestUser(testUser.id);
  });

  it('should get user profile', async () => {
    // 使用独立的 testUser
  });
});
```

### 8.2 并行测试

**Jest 并行配置**:
```javascript
// jest.config.js
module.exports = {
  maxWorkers: '50%',  // 使用 50% 的 CPU 核心
};
```

**Playwright 并行配置**:
```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 1 : undefined,  // CI 环境串行,本地并行
});
```

### 8.3 测试稳定性

**避免 Flaky 测试**:
- 使用明确的等待条件 (`waitFor`, `waitForSelector`)
- 避免硬编码延迟 (`sleep`)
- 使用确定性的测试数据
- 避免依赖外部服务

**重试机制**:
```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,  // CI 环境重试 2 次
});
```

---

## 9. 常用命令速查

### 9.1 Docker 命令

```bash
# 启动所有服务
docker-compose -f docker-compose.test.yml up -d

# 停止所有服务
docker-compose -f docker-compose.test.yml down

# 停止并删除数据卷
docker-compose -f docker-compose.test.yml down -v

# 查看服务状态
docker-compose -f docker-compose.test.yml ps

# 查看日志
docker-compose -f docker-compose.test.yml logs -f [service_name]

# 重启服务
docker-compose -f docker-compose.test.yml restart [service_name]

# 进入容器
docker exec -it open-meeting-postgres-test bash

# 清理所有停止的容器
docker container prune

# 清理所有未使用的数据卷
docker volume prune
```

### 9.2 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行特定浏览器的 E2E 测试
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# 生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch

# CI 环境完整测试
npm run test:ci

# 运行性能测试
npm run test:performance
```

### 9.3 数据库命令

```bash
# 连接 PostgreSQL
docker exec -it open-meeting-postgres-test psql -U test_user -d open_meeting_test

# 执行 SQL 文件
docker exec -i open-meeting-postgres-test psql -U test_user -d open_meeting_test < schema.sql

# 导出数据
docker exec open-meeting-postgres-test pg_dump -U test_user open_meeting_test > backup.sql

# 导入数据
docker exec -i open-meeting-postgres-test psql -U test_user -d open_meeting_test < backup.sql
```

### 9.4 Redis 命令

```bash
# 连接 Redis
docker exec -it open-meeting-redis-test redis-cli

# 查看所有 Key
KEYS *

# 获取 Key 的值
GET key_name

# 删除 Key
DEL key_name

# 清空所有数据
FLUSHALL

# 退出
exit
```

---

## 10. 故障排查清单

### 10.1 测试失败排查

- [ ] 检查 Docker 服务是否启动
- [ ] 检查环境变量配置是否正确
- [ ] 检查测试数据是否准备就绪
- [ ] 查看详细错误日志
- [ ] 尝试清理缓存后重新运行
- [ ] 检查是否有端口冲突
- [ ] 确认依赖版本是否正确

### 10.2 性能问题排查

- [ ] 检查 Docker 资源配置
- [ ] 查看数据库慢查询日志
- [ ] 检查 Redis 内存使用
- [ ] 查看网络延迟
- [ ] 分析测试覆盖率报告
- [ ] 使用性能分析工具

### 10.3 环境问题排查

- [ ] 确认 Docker Desktop 正常运行
- [ ] 检查磁盘空间是否充足
- [ ] 检查网络连接是否正常
- [ ] 查看系统资源使用情况
- [ ] 尝试重启 Docker Desktop
- [ ] 清理 Docker 缓存和无用镜像

---

## 11. 附录

### 11.1 相关文档

- [测试计划](./test_plan.md)
- [测试用例模板](./test_case_template.md)
- [缺陷管理流程](./bug_management.md)
- [测试框架 README](../../tests/README.md)

### 11.2 外部资源

- [Docker 官方文档](https://docs.docker.com/)
- [Jest 官方文档](https://jestjs.io/)
- [Playwright 官方文档](https://playwright.dev/)
- [K6 性能测试文档](https://k6.io/docs/)

### 11.3 联系方式

遇到问题可联系:
- **测试 Leader**: test-leader@openmeeting.dev
- **运维 Leader**: devops-leader@openmeeting.dev

---

**文档版本历史**:
- v1.0 (2026-02-13): 初版发布

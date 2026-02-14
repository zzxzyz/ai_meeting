# 测试框架文档

## 目录结构

```
tests/
├── unit/           # 单元测试
│   ├── backend/    # 后端单元测试
│   └── frontend/   # 前端单元测试
├── integration/    # 集成测试
│   ├── api/        # API 集成测试
│   └── database/   # 数据库集成测试
└── e2e/            # 端到端测试
    ├── web/        # Web 端 E2E 测试
    └── electron/   # Electron 客户端 E2E 测试
```

## 测试框架

### 单元测试
- **框架**: Jest
- **适用范围**:
  - 后端业务逻辑 (NestJS Services, Domain Models)
  - 前端组件和 Hooks (React Components, Custom Hooks)
  - 工具函数和值对象
- **运行命令**: `npm run test:unit`
- **覆盖率目标**: P0>90%, P1>80%, P2>70%

### 集成测试
- **框架**: Jest + Supertest
- **适用范围**:
  - RESTful API 接口测试
  - WebSocket 信令服务测试
  - 数据库操作测试
  - 跨模块交互测试
- **运行命令**: `npm run test:integration`
- **覆盖率目标**: >60%

### 端到端测试
- **框架**: Playwright
- **适用范围**:
  - 完整业务流程验证
  - 跨浏览器兼容性测试 (Chrome/Safari/Firefox/Edge)
  - Web/Electron 互通测试
- **运行命令**: `npm run test:e2e`
- **覆盖率目标**: 关键路径 100%

## 测试覆盖率

测试覆盖率报告由 Istanbul (nyc) 生成:
- 报告目录: `coverage/`
- HTML 报告: `coverage/lcov-report/index.html`
- 查看命令: `npm run test:coverage`

## CI/CD 集成

测试在 CI/CD 流水线中自动执行:
1. 代码提交触发单元测试
2. PR 创建触发集成测试
3. 合并到主分支触发 E2E 测试
4. 覆盖率未达标阻塞 PR 合并

详见: `docs/testing/ci_cd_integration.md`

## 快速开始

### 本地环境搭建

1. 安装依赖:
```bash
npm install
```

2. 启动测试环境:
```bash
docker-compose -f docker-compose.test.yml up -d
```

3. 运行测试:
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

### 编写测试用例

参考测试用例模板:
- 单元测试: `docs/testing/test_case_template.md#单元测试模板`
- 集成测试: `docs/testing/test_case_template.md#集成测试模板`
- E2E 测试: `docs/testing/test_case_template.md#E2E测试模板`

## 相关文档

- [测试计划](../docs/testing/test_plan.md)
- [测试用例模板](../docs/testing/test_case_template.md)
- [缺陷管理流程](../docs/testing/bug_management.md)
- [测试环境配置指南](../docs/testing/environment_setup.md)

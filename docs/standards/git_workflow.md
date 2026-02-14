# Git 分支管理规范

## 1. 分支策略

### 1.1 Git Flow (推荐)

**分支类型**：
```
main (master)      ← 生产环境
  ↑
release/*          ← 发布分支
  ↑
develop            ← 开发主分支
  ↑
feature/*          ← 功能分支
hotfix/*           ← 紧急修复分支
```

---

### 1.2 分支说明

#### main (或 master)
- **用途**：生产环境代码
- **保护**：禁止直接 push,必须通过 PR
- **触发**：自动部署到生产环境
- **合并来源**：release 分支、hotfix 分支

#### develop
- **用途**：开发主分支,集成所有功能
- **保护**：禁止直接 push,必须通过 PR
- **触发**：自动部署到测试环境
- **合并来源**：feature 分支

#### feature/*
- **用途**：新功能开发
- **命名**：`feature/issue-编号-功能描述`
  - `feature/123-user-authentication`
  - `feature/456-screen-share`
- **生命周期**：开发完成后合并到 develop,然后删除
- **基于**：develop 分支

#### release/*
- **用途**：版本发布准备
- **命名**：`release/版本号`
  - `release/v1.0.0`
  - `release/v1.1.0`
- **生命周期**：发布后合并到 main 和 develop,然后删除
- **基于**：develop 分支

#### hotfix/*
- **用途**：生产环境紧急修复
- **命名**：`hotfix/issue-编号-问题描述`
  - `hotfix/789-fix-crash`
- **生命周期**：修复后合并到 main 和 develop,然后删除
- **基于**：main 分支

---

## 2. 工作流程

### 2.1 功能开发流程

```bash
# 1. 从 develop 创建 feature 分支
git checkout develop
git pull origin develop
git checkout -b feature/123-add-chat

# 2. 开发功能,提交代码
git add .
git commit -m "feat: add chat message component"
git commit -m "feat: add chat send functionality"

# 3. 推送到远程
git push origin feature/123-add-chat

# 4. 创建 Pull Request (GitHub/GitLab)
# - 目标分支: develop
# - 填写 PR 描述
# - 关联 Issue: #123
# - 添加 Reviewer

# 5. Code Review 通过后合并
# - Squash and merge (推荐,保持提交历史简洁)
# - Merge commit (保留所有提交)

# 6. 删除 feature 分支
git checkout develop
git branch -d feature/123-add-chat
git push origin --delete feature/123-add-chat
```

---

### 2.2 发布流程

```bash
# 1. 从 develop 创建 release 分支
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# 2. 更新版本号
# - package.json
# - CHANGELOG.md

git add .
git commit -m "chore: bump version to 1.0.0"

# 3. 测试和修复 bug
git commit -m "fix: resolve login issue"

# 4. 合并到 main
git checkout main
git merge --no-ff release/v1.0.0
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags

# 5. 合并回 develop
git checkout develop
git merge --no-ff release/v1.0.0
git push origin develop

# 6. 删除 release 分支
git branch -d release/v1.0.0
git push origin --delete release/v1.0.0
```

---

### 2.3 Hotfix 流程

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git pull origin main
git checkout -b hotfix/789-fix-crash

# 2. 修复 bug
git commit -m "fix: resolve null pointer exception"

# 3. 合并到 main
git checkout main
git merge --no-ff hotfix/789-fix-crash
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin main --tags

# 4. 合并到 develop
git checkout develop
git merge --no-ff hotfix/789-fix-crash
git push origin develop

# 5. 删除 hotfix 分支
git branch -d hotfix/789-fix-crash
git push origin --delete hotfix/789-fix-crash
```

---

## 3. Commit 规范

### 3.1 Commit Message 格式

**格式**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例**：
```
feat(meeting): add screen sharing feature

- Implement screen capture
- Add UI controls for screen share
- Handle screen share events

Closes #123
```

---

### 3.2 Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| **feat** | 新功能 | `feat: add user login` |
| **fix** | Bug 修复 | `fix: resolve memory leak` |
| **docs** | 文档更新 | `docs: update README` |
| **style** | 代码格式 | `style: format code with prettier` |
| **refactor** | 重构 | `refactor: extract common logic` |
| **perf** | 性能优化 | `perf: optimize video rendering` |
| **test** | 测试 | `test: add unit tests for auth` |
| **chore** | 构建/工具 | `chore: update dependencies` |
| **ci** | CI/CD | `ci: add GitHub Actions workflow` |
| **revert** | 回滚 | `revert: revert feat: add chat` |

---

### 3.3 Scope 范围

**模块名称**：
- `auth`: 认证模块
- `meeting`: 会议模块
- `chat`: 聊天模块
- `webrtc`: WebRTC 模块
- `ui`: UI 组件
- `api`: API 接口
- `deps`: 依赖更新

---

### 3.4 Subject 主题

**规则**：
- 使用祈使句：`add` 而不是 `added`
- 不要大写首字母
- 不要句号结尾
- 简洁明了（<50 字符）

**示例**：
```
✅ feat: add user profile page
❌ feat: Added user profile page.
❌ feat: Add User Profile Page
```

---

### 3.5 Body 正文

**可选**,详细说明：
- 修改原因
- 实现方式
- 影响范围

**示例**：
```
feat(webrtc): implement simulcast

Add support for sending multiple video resolutions simultaneously.
This improves video quality for participants with different network conditions.

Implementation:
- Configure 3 spatial layers (180p, 360p, 720p)
- Server selects appropriate layer based on subscriber bandwidth
- Fallback to single layer if browser doesn't support simulcast
```

---

### 3.6 Footer 脚注

**关联 Issue**：
```
Closes #123
Fixes #456
Refs #789
```

**Breaking Changes**：
```
BREAKING CHANGE: API endpoint /api/v1/login changed to /api/v2/auth/login
```

---

## 4. Pull Request 规范

### 4.1 PR 标题

**格式**：与 Commit Message 一致
```
feat(meeting): add screen sharing feature
```

---

### 4.2 PR 描述模板

```markdown
## 描述
简要描述此 PR 的目的和实现。

## 关联 Issue
Closes #123

## 修改内容
- [ ] 新功能：屏幕共享
- [ ] UI 组件：屏幕共享按钮
- [ ] API 接口：POST /api/v1/screen-share

## 测试
- [ ] 单元测试已通过
- [ ] 集成测试已通过
- [ ] 手动测试已完成

## 截图 (可选)
[添加功能截图或录屏]

## CheckList
- [ ] 代码符合编码规范
- [ ] 已添加必要的测试
- [ ] 文档已更新
- [ ] 无 Breaking Changes (或已在 Footer 说明)
```

---

### 4.3 Code Review 要点

**Reviewer 职责**：
- 检查代码质量（可读性、可维护性）
- 检查测试覆盖率
- 检查性能问题
- 检查安全问题
- 提出改进建议

**Review 标签**：
- ✅ **Approve**：通过,可合并
- 💬 **Comment**：建议,不阻止合并
- ❌ **Request Changes**：必须修改

---

## 5. 分支保护规则

### 5.1 main 分支保护

**GitHub Settings → Branches → Branch protection rules**

```yaml
Branch name pattern: main

Protection rules:
  ✅ Require pull request before merging
    - Required approvals: 2
    - Dismiss stale reviews
    - Require review from Code Owners

  ✅ Require status checks before merging
    - Build
    - Test
    - Lint

  ✅ Require conversation resolution before merging

  ✅ Require signed commits

  ✅ Include administrators

  ✅ Restrict who can push to matching branches
    - Allow: Release Manager
```

---

### 5.2 develop 分支保护

```yaml
Branch name pattern: develop

Protection rules:
  ✅ Require pull request before merging
    - Required approvals: 1

  ✅ Require status checks before merging
    - Build
    - Test

  ✅ Require conversation resolution before merging
```

---

## 6. Git Hooks

### 6.1 Pre-commit Hook

**安装工具**：
```bash
npm install --save-dev husky lint-staged
npx husky install
```

**配置**：
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{js,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

**commitlint 配置**：
```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'ci', 'revert'
    ]],
    'subject-case': [0]
  }
};
```

---

## 7. 常见问题

### 7.1 合并冲突

```bash
# 1. 更新目标分支
git checkout develop
git pull origin develop

# 2. 回到 feature 分支
git checkout feature/123-add-chat

# 3. Rebase (推荐)
git rebase develop

# 4. 解决冲突
# 编辑冲突文件
git add .
git rebase --continue

# 5. 强制推送 (rebase 后)
git push origin feature/123-add-chat --force-with-lease
```

---

### 7.2 撤销提交

**未 push 的提交**：
```bash
# 撤销最后一次提交,保留修改
git reset --soft HEAD~1

# 撤销最后一次提交,丢弃修改
git reset --hard HEAD~1
```

**已 push 的提交**：
```bash
# 创建反向提交
git revert HEAD
git push origin feature/123
```

---

### 7.3 Cherry-pick

```bash
# 将特定提交应用到当前分支
git cherry-pick <commit-hash>
```

---

## 8. 参考资料

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

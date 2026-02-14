# 测试用例模板

本文档提供三种类型的测试用例模板:单元测试、集成测试和端到端测试。

---

## 1. 单元测试模板

### 1.1 后端单元测试 (Jest)

```javascript
/**
 * 测试文件: src/domain/user/__tests__/user.entity.test.ts
 * 测试对象: User 实体
 */

describe('User Entity', () => {
  describe('创建用户', () => {
    it('应该成功创建用户', () => {
      // Arrange (准备测试数据)
      const email = 'test@example.com';
      const password = 'SecurePass123';
      const name = 'Test User';

      // Act (执行被测试的操作)
      const user = User.create(email, password, name);

      // Assert (断言结果)
      expect(user).toBeDefined();
      expect(user.email.value).toBe(email);
      expect(user.name).toBe(name);
      expect(user.id).toBeDefined();
    });

    it('应该抛出错误当邮箱格式无效时', () => {
      // Arrange
      const invalidEmail = 'invalid-email';
      const password = 'SecurePass123';
      const name = 'Test User';

      // Act & Assert
      expect(() => {
        User.create(invalidEmail, password, name);
      }).toThrow(InvalidEmailError);
    });
  });

  describe('密码管理', () => {
    it('应该成功修改密码', () => {
      // Arrange
      const user = User.create('test@example.com', 'OldPass123', 'Test');
      const newPassword = 'NewPass456';

      // Act
      user.changePassword('OldPass123', newPassword);

      // Assert
      expect(user.password.verify(newPassword)).toBe(true);
    });

    it('应该拒绝错误的旧密码', () => {
      // Arrange
      const user = User.create('test@example.com', 'OldPass123', 'Test');

      // Act & Assert
      expect(() => {
        user.changePassword('WrongPass', 'NewPass456');
      }).toThrow(InvalidPasswordError);
    });
  });
});
```

### 1.2 前端单元测试 (React Testing Library)

```typescript
/**
 * 测试文件: src/components/Button/__tests__/Button.test.tsx
 * 测试对象: Button 组件
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  it('应该渲染按钮文本', () => {
    // Arrange & Act
    render(<Button>Click Me</Button>);

    // Assert
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('应该在点击时调用 onClick 回调', () => {
    // Arrange
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    // Act
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('应该在 loading 状态下禁用按钮', () => {
    // Arrange & Act
    render(<Button loading>Click Me</Button>);

    // Assert
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('应该应用正确的 variant 样式', () => {
    // Arrange & Act
    render(<Button variant="primary">Primary</Button>);

    // Assert
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600');
  });
});
```

### 1.3 自定义 Hook 测试

```typescript
/**
 * 测试文件: src/hooks/__tests__/useLocalStream.test.ts
 * 测试对象: useLocalStream Hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalStream } from '../useLocalStream';

// Mock navigator.mediaDevices
beforeAll(() => {
  global.navigator.mediaDevices = {
    getUserMedia: jest.fn(),
  };
});

describe('useLocalStream Hook', () => {
  it('应该成功获取本地媒体流', async () => {
    // Arrange
    const mockStream = new MediaStream();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);

    // Act
    const { result } = renderHook(() => useLocalStream());

    await act(async () => {
      await result.current.start();
    });

    // Assert
    await waitFor(() => {
      expect(result.current.stream).toBe(mockStream);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it('应该处理权限拒绝错误', async () => {
    // Arrange
    const error = new Error('Permission denied');
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useLocalStream());

    await act(async () => {
      await result.current.start().catch(() => {});
    });

    // Assert
    await waitFor(() => {
      expect(result.current.stream).toBeNull();
      expect(result.current.error).toBe(error);
    });
  });
});
```

---

## 2. 集成测试模板

### 2.1 API 集成测试 (Supertest)

```typescript
/**
 * 测试文件: tests/integration/api/auth.test.ts
 * 测试对象: 用户认证 API
 */

import request from 'supertest';
import { app } from '../../../src/app';
import { clearDatabase, seedTestData } from '../../helpers/database';

describe('User Authentication API', () => {
  beforeAll(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('应该成功注册新用户', async () => {
      // Arrange
      const newUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        name: 'New User',
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        code: 201,
        message: 'success',
      });
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email', newUser.email);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('应该拒绝重复的邮箱', async () => {
      // Arrange
      const user = {
        email: 'existing@example.com',
        password: 'SecurePass123',
        name: 'Existing User',
      };
      await request(app).post('/api/v1/auth/register').send(user);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(user)
        .expect(409);

      // Assert
      expect(response.body.code).toBe(100202); // 用户已存在
      expect(response.body.message).toContain('already exists');
    });

    it('应该验证必填字段', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.code).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' }),
          expect.objectContaining({ field: 'name' }),
        ])
      );
    });

    it('应该验证密码强度', async () => {
      // Arrange
      const weakPassword = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(weakPassword)
        .expect(400);

      // Assert
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('at least 8 characters'),
          }),
        ])
      );
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // 注册测试用户
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
          name: 'Test User',
        });
    });

    it('应该成功登录并返回 Token', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        })
        .expect(200);

      // Assert
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('expiresIn', 3600);
      expect(response.body.data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT 格式
    });

    it('应该拒绝错误的密码', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      // Assert
      expect(response.body.code).toBe(100101); // 密码错误
    });

    it('应该拒绝不存在的用户', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123',
        })
        .expect(404);

      // Assert
      expect(response.body.code).toBe(100201); // 用户不存在
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('应该使用 Refresh Token 刷新 Access Token', async () => {
      // Arrange - 先登录获取 Token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        });
      const { refreshToken } = loginResponse.body.data;

      // Act
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Assert
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.accessToken).not.toBe(loginResponse.body.data.accessToken);
    });

    it('应该拒绝无效的 Refresh Token', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      // Assert
      expect(response.body.code).toBe(100103); // Token 无效
    });
  });

  describe('API 限流', () => {
    it('应该在超过限流阈值时返回 429', async () => {
      // Arrange - 发送 101 次请求 (假设限流为 100 req/min)
      const requests = Array.from({ length: 101 }, () =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword',
          })
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      const rateLimitedResponse = responses.find(res => res.status === 429);
      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse.body.code).toBe(429);
    });
  });
});
```

### 2.2 WebSocket 集成测试

```typescript
/**
 * 测试文件: tests/integration/websocket/signaling.test.ts
 * 测试对象: 信令服务 WebSocket
 */

import { io, Socket } from 'socket.io-client';
import { app } from '../../../src/app';

describe('Signaling WebSocket', () => {
  let server: any;
  let client1: Socket;
  let client2: Socket;
  const PORT = 3001;

  beforeAll((done) => {
    server = app.listen(PORT, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    client1 = io(`http://localhost:${PORT}`, {
      auth: { token: 'valid-jwt-token-1' },
    });
    client2 = io(`http://localhost:${PORT}`, {
      auth: { token: 'valid-jwt-token-2' },
    });
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });

  it('应该成功建立 WebSocket 连接', (done) => {
    client1.on('connect', () => {
      expect(client1.connected).toBe(true);
      done();
    });
  });

  it('应该在加入房间时通知其他参与者', (done) => {
    // Arrange
    const meetingId = 'test-meeting-123';

    // Client 1 先加入房间
    client1.emit('join-room', { meetingId });

    // Client 2 加入房间时, Client 1 应该收到通知
    client1.on('participant-joined', (data) => {
      expect(data.userId).toBeDefined();
      done();
    });

    // Act
    setTimeout(() => {
      client2.emit('join-room', { meetingId });
    }, 100);
  });

  it('应该正确转发 WebRTC Offer/Answer', (done) => {
    // Arrange
    const meetingId = 'test-meeting-123';
    const offer = {
      type: 'offer',
      sdp: 'mock-sdp-offer',
    };

    // Client 1 和 Client 2 都加入房间
    client1.emit('join-room', { meetingId });
    client2.emit('join-room', { meetingId });

    // Client 2 监听 Offer
    client2.on('webrtc-offer', (data) => {
      expect(data.offer).toEqual(offer);
      expect(data.from).toBeDefined();
      done();
    });

    // Act - Client 1 发送 Offer
    setTimeout(() => {
      client1.emit('webrtc-offer', {
        meetingId,
        to: client2.id,
        offer,
      });
    }, 200);
  });
});
```

---

## 3. 端到端测试模板

### 3.1 Web 端 E2E 测试 (Playwright)

```typescript
/**
 * 测试文件: tests/e2e/web/authentication.spec.ts
 * 测试对象: 用户认证流程
 */

import { test, expect } from '@playwright/test';

test.describe('用户认证流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该成功注册新用户', async ({ page }) => {
    // 点击注册按钮
    await page.click('text=注册');

    // 填写注册表单
    await page.fill('input[name="email"]', `test_${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.fill('input[name="name"]', 'Test User');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证跳转到首页
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=欢迎')).toBeVisible();
  });

  test('应该成功登录并跳转到首页', async ({ page }) => {
    // 导航到登录页
    await page.click('text=登录');

    // 填写登录表单
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待跳转
    await page.waitForURL('/dashboard');

    // 验证登录成功
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('应该显示错误提示当密码错误时', async ({ page }) => {
    // 导航到登录页
    await page.goto('/login');

    // 填写错误的登录信息
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'WrongPassword');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=密码错误')).toBeVisible();
    await expect(page).toHaveURL('/login'); // 仍在登录页
  });

  test('应该验证必填字段', async ({ page }) => {
    await page.goto('/login');

    // 不填写任何信息,直接提交
    await page.click('button[type="submit"]');

    // 验证必填字段提示
    await expect(page.locator('text=邮箱不能为空')).toBeVisible();
  });

  test('应该记住用户登录状态', async ({ page, context }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 关闭页面并重新打开
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto('/');

    // 验证自动跳转到首页 (无需重新登录)
    await expect(newPage).toHaveURL('/dashboard');
  });
});
```

### 3.2 WebRTC 音视频测试

```typescript
/**
 * 测试文件: tests/e2e/web/video-call.spec.ts
 * 测试对象: 音视频通话流程
 */

import { test, expect } from '@playwright/test';

test.describe('音视频通话', () => {
  test.use({
    permissions: ['camera', 'microphone'],
  });

  test('应该成功创建会议并获取本地媒体流', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 创建会议
    await page.click('button:has-text("创建会议")');
    await page.fill('input[name="title"]', 'E2E Test Meeting');
    await page.click('button:has-text("立即开始")');

    // 等待进入会议室
    await page.waitForURL(/\/meeting\/.+/);

    // 验证本地视频流
    const localVideo = page.locator('video[data-testid="local-video"]');
    await expect(localVideo).toBeVisible();

    // 验证视频在播放 (检查 readyState)
    const readyState = await localVideo.evaluate((video: HTMLVideoElement) => video.readyState);
    expect(readyState).toBeGreaterThanOrEqual(2); // HAVE_CURRENT_DATA

    // 验证音视频控制按钮
    await expect(page.locator('button[aria-label="静音"]')).toBeVisible();
    await expect(page.locator('button[aria-label="关闭摄像头"]')).toBeVisible();
  });

  test('应该能够切换静音状态', async ({ page }) => {
    // 进入会议室 (假设已登录并创建会议)
    await page.goto('/meeting/test-meeting-id');

    // 等待本地视频加载
    await page.waitForSelector('video[data-testid="local-video"]');

    // 点击静音按钮
    const muteButton = page.locator('button[aria-label="静音"]');
    await muteButton.click();

    // 验证静音状态
    await expect(muteButton).toHaveAttribute('aria-label', '取消静音');
    await expect(page.locator('[data-testid="muted-indicator"]')).toBeVisible();

    // 再次点击取消静音
    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-label', '静音');
  });

  test('应该能够切换摄像头开关', async ({ page }) => {
    await page.goto('/meeting/test-meeting-id');
    await page.waitForSelector('video[data-testid="local-video"]');

    // 点击关闭摄像头按钮
    const videoButton = page.locator('button[aria-label="关闭摄像头"]');
    await videoButton.click();

    // 验证摄像头关闭
    await expect(videoButton).toHaveAttribute('aria-label', '开启摄像头');
    const localVideo = page.locator('video[data-testid="local-video"]');

    // 验证视频轨道已停止
    const hasVideo = await localVideo.evaluate((video: HTMLVideoElement) => {
      const stream = video.srcObject as MediaStream;
      return stream && stream.getVideoTracks().some(track => track.enabled);
    });
    expect(hasVideo).toBe(false);
  });
});
```

### 3.3 跨浏览器测试

```typescript
/**
 * 测试文件: tests/e2e/cross-browser/compatibility.spec.ts
 * 测试对象: 跨浏览器兼容性
 */

import { test, expect } from '@playwright/test';

// 定义测试数据
const browsers = ['chromium', 'firefox', 'webkit'] as const;

browsers.forEach((browserType) => {
  test.describe(`${browserType} 浏览器兼容性`, () => {
    test.use({
      browserName: browserType,
      permissions: ['camera', 'microphone'],
    });

    test(`应该在 ${browserType} 中正常运行音视频通话`, async ({ page }) => {
      // 登录
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // 加入会议
      await page.click('button:has-text("加入会议")');
      await page.fill('input[name="meetingId"]', 'test-meeting-123');
      await page.click('button:has-text("加入")');

      // 等待进入会议室
      await page.waitForURL(/\/meeting\/.+/);

      // 验证本地视频流
      const localVideo = page.locator('video[data-testid="local-video"]');
      await expect(localVideo).toBeVisible();

      // 验证控制按钮可用
      await expect(page.locator('button[aria-label="静音"]')).toBeEnabled();
      await expect(page.locator('button[aria-label="关闭摄像头"]')).toBeEnabled();
    });
  });
});
```

---

## 4. 性能测试模板

### 4.1 API 压力测试 (K6)

```javascript
/**
 * 测试文件: tests/performance/api-load-test.js
 * 工具: K6
 * 运行: k6 run tests/performance/api-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 30秒内增加到10个用户
    { duration: '1m', target: 50 },    // 1分钟内增加到50个用户
    { duration: '2m', target: 100 },   // 2分钟内增加到100个用户
    { duration: '30s', target: 0 },    // 30秒内减少到0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% 的请求应在 200ms 内完成
    http_req_failed: ['rate<0.01'],    // 错误率应低于 1%
    errors: ['rate<0.1'],              // 自定义错误率应低于 10%
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // 1. 用户注册
  const registerPayload = JSON.stringify({
    email: `test_${Date.now()}_${__VU}@example.com`,
    password: 'SecurePass123',
    name: `Test User ${__VU}`,
  });

  const registerRes = http.post(`${BASE_URL}/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    '注册成功': (r) => r.status === 201,
    '返回 Token': (r) => r.json('data.accessToken') !== '',
  }) || errorRate.add(1);

  sleep(1);

  // 2. 获取会议列表
  const token = registerRes.json('data.accessToken');
  const listRes = http.get(`${BASE_URL}/meetings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(listRes, {
    '获取列表成功': (r) => r.status === 200,
    '响应时间 < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(1);
}
```

---

## 5. 测试用例文档模板

### 5.1 功能测试用例文档

```markdown
# 测试用例文档

## 测试用例信息
- **用例ID**: TC-AUTH-001
- **用例标题**: 用户注册 - 成功场景
- **所属模块**: 用户认证 (REQ-001)
- **优先级**: P0
- **创建人**: 测试工程师
- **创建日期**: 2026-02-13

## 前置条件
- 测试环境已启动
- 数据库已清空
- 没有 test@example.com 的注册用户

## 测试步骤
1. 访问注册页面 (/register)
2. 填写邮箱: test@example.com
3. 填写密码: SecurePass123
4. 填写姓名: Test User
5. 点击"注册"按钮

## 预期结果
1. 显示"注册成功"提示
2. 自动跳转到首页 (/dashboard)
3. 显示用户名"Test User"
4. 数据库中创建新用户记录
5. 密码已加密存储

## 实际结果
(执行测试后填写)

## 测试结果
- [ ] 通过
- [ ] 失败
- [ ] 阻塞

## 备注
(如有问题或特殊说明)
```

---

## 6. 测试报告模板

### 6.1 测试执行报告

```markdown
# 测试执行报告

## 基本信息
- **测试阶段**: Phase 2 - 基础设施测试
- **测试周期**: 2026-02-20 ~ 2026-03-03 (Week 2-3)
- **测试负责人**: 测试 Leader
- **报告日期**: 2026-03-03

## 测试概况
- **计划测试用例数**: 50
- **实际执行用例数**: 48
- **通过用例数**: 45
- **失败用例数**: 3
- **阻塞用例数**: 2
- **测试通过率**: 93.75%

## 功能测试结果
| 模块 | 计划 | 执行 | 通过 | 失败 | 阻塞 | 通过率 |
|-----|------|------|------|------|------|--------|
| 用户认证 | 20 | 20 | 19 | 1 | 0 | 95% |
| 会议管理 | 30 | 28 | 26 | 2 | 2 | 92.9% |

## 测试覆盖率
| 类型 | 覆盖率 | 目标 | 达标 |
|------|--------|------|------|
| 单元测试 | 87% | >85% | ✅ |
| 集成测试 | 82% | >80% | ✅ |
| E2E 测试 | 100% | 100% | ✅ |

## 缺陷统计
| 优先级 | 新增 | 修复 | 遗留 |
|--------|------|------|------|
| P0 | 1 | 1 | 0 |
| P1 | 3 | 1 | 2 |
| P2 | 5 | 2 | 3 |
| **合计** | **9** | **4** | **5** |

## 风险与建议
1. **风险**: 会议管理模块有2个用例阻塞,影响后续测试
   - **建议**: 优先修复 BUG-123 和 BUG-124

2. **风险**: API 响应时间偶尔超过200ms
   - **建议**: 进行性能优化分析

## 结论
Phase 2 测试基本达标,建议修复所有 P0/P1 缺陷后进入 Phase 3。
```

---

## 7. 测试数据模板

### 7.1 测试数据准备

```typescript
/**
 * 测试数据工厂
 * 用于生成测试所需的各种数据
 */

export class TestDataFactory {
  /**
   * 生成测试用户
   */
  static createUser(overrides?: Partial<User>): User {
    return {
      id: `user-${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'SecurePass123',
      name: 'Test User',
      createdAt: new Date(),
      ...overrides,
    };
  }

  /**
   * 生成测试会议
   */
  static createMeeting(overrides?: Partial<Meeting>): Meeting {
    return {
      id: `meeting-${Date.now()}`,
      title: 'Test Meeting',
      hostId: 'user-123',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000), // 1小时后
      status: 'scheduled',
      participants: [],
      ...overrides,
    };
  }

  /**
   * 生成批量测试数据
   */
  static createUsers(count: number): User[] {
    return Array.from({ length: count }, (_, i) =>
      this.createUser({
        email: `test${i}@example.com`,
        name: `Test User ${i}`,
      })
    );
  }
}
```

---

## 8. Mock 数据模板

### 8.1 API Mock 响应

```typescript
/**
 * Mock API 响应数据
 */

export const mockApiResponses = {
  // 用户注册成功响应
  registerSuccess: {
    code: 201,
    message: 'success',
    data: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: '2026-02-13T10:00:00Z',
    },
    timestamp: 1678886400,
  },

  // 用户登录成功响应
  loginSuccess: {
    code: 200,
    message: 'success',
    data: {
      accessToken: 'eyJhbGci...',
      refreshToken: 'eyJhbGci...',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
    timestamp: 1678886400,
  },

  // 错误响应
  validationError: {
    code: 400,
    message: 'Validation failed',
    errors: [
      {
        field: 'email',
        message: 'Email is required',
      },
    ],
    timestamp: 1678886400,
  },
};
```

---

## 附录

### 相关文档
- [测试计划](./test_plan.md)
- [缺陷管理流程](./bug_management.md)
- [测试环境配置](./environment_setup.md)

### 工具文档
- [Jest 官方文档](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright 文档](https://playwright.dev/)
- [K6 文档](https://k6.io/docs/)

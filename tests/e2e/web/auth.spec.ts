/**
 * REQ-001 认证流程 - Web 端 E2E 测试
 *
 * 测试范围：
 * 1. 用户注册流程（表单验证、成功/失败场景）
 * 2. 用户登录流程（表单验证、成功/失败场景）
 * 3. 自动跳转和会话保持
 * 4. 错误提示和用户体验
 *
 * 测试工具：Playwright
 * 测试浏览器：Chromium, Firefox, Safari, Edge
 */

import { test, expect, Page } from '@playwright/test';

// 测试数据
const testUser = {
  email: `e2e-${Date.now()}@example.com`,
  password: 'E2ETest123',
  nickname: 'E2E测试用户',
};

// 辅助函数：等待并验证 Toast 提示
async function expectToast(page: Page, message: string) {
  const toast = page.locator('[role="alert"], .toast, .notification').filter({
    hasText: message,
  });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

// 辅助函数：等待加载完成
async function waitForLoading(page: Page) {
  const loading = page.locator('[data-testid="loading"], .loading, .spinner');
  await loading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
    // 如果没有找到 loading 元素，忽略错误
  });
}

test.describe('REQ-001 Web 端认证流程 E2E 测试', () => {
  test.describe('用户注册流程', () => {
    test.beforeEach(async ({ page }) => {
      // 访问注册页面
      await page.goto('/register');
      await expect(page).toHaveTitle(/注册|Register/i);
    });

    test('应该成功注册新用户并跳转到首页', async ({ page }) => {
      // 填写注册表单
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill(
        'input[name="password"], input[type="password"]',
        testUser.password,
      );
      await page.fill('input[name="nickname"]', testUser.nickname);

      // 提交表单
      await page.click('button[type="submit"], button:has-text("注册")');

      // 等待加载
      await waitForLoading(page);

      // 验证跳转到首页/仪表板
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });

      // 验证用户信息显示
      await expect(
        page.locator(
          `text=${testUser.nickname}, [data-testid="user-name"]:has-text("${testUser.nickname}")`,
        ),
      ).toBeVisible();
    });

    test('应该显示邮箱格式错误提示', async ({ page }) => {
      // 填写无效邮箱
      await page.fill('input[name="email"], input[type="email"]', 'invalid-email');
      await page.fill(
        'input[name="password"], input[type="password"]',
        'Password123',
      );
      await page.fill('input[name="nickname"]', '测试用户');

      // 提交表单
      await page.click('button[type="submit"], button:has-text("注册")');

      // 验证错误提示
      const errorMessage = page.locator(
        'text=/邮箱格式|email.*invalid|invalid.*email/i',
      );
      await expect(errorMessage).toBeVisible();

      // 验证未跳转
      await expect(page).toHaveURL(/\/register/);
    });

    test('应该显示密码长度不足提示', async ({ page }) => {
      // 填写短密码
      await page.fill(
        'input[name="email"], input[type="email"]',
        'test@example.com',
      );
      await page.fill('input[name="password"], input[type="password"]', '123');
      await page.fill('input[name="nickname"]', '测试用户');

      // 提交表单（可能在客户端验证就被拦截）
      await page.click('button[type="submit"], button:has-text("注册")');

      // 验证错误提示
      const errorMessage = page.locator(
        'text=/密码.*8.*位|password.*8.*characters/i',
      );
      await expect(errorMessage).toBeVisible();
    });

    test('应该显示昵称长度不符合要求的提示', async ({ page }) => {
      // 填写过长昵称
      await page.fill(
        'input[name="email"], input[type="email"]',
        'test@example.com',
      );
      await page.fill(
        'input[name="password"], input[type="password"]',
        'Password123',
      );
      await page.fill(
        'input[name="nickname"]',
        '这是一个非常非常非常非常非常长的昵称超过20个字符',
      );

      // 提交表单
      await page.click('button[type="submit"], button:has-text("注册")');

      // 验证错误提示
      const errorMessage = page.locator(
        'text=/昵称.*长度|nickname.*length/i',
      );
      await expect(errorMessage).toBeVisible();
    });

    test('应该显示必填字段提示', async ({ page }) => {
      // 不填写任何信息，直接提交
      await page.click('button[type="submit"], button:has-text("注册")');

      // 验证必填字段提示（HTML5 原生验证或自定义验证）
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
        return !el.checkValidity() || el.getAttribute('aria-invalid') === 'true';
      });

      expect(isInvalid).toBe(true);
    });

    test('应该显示邮箱已被注册的提示', async ({ page }) => {
      // 先注册一个用户
      const existingUser = {
        email: `existing-${Date.now()}@example.com`,
        password: 'Password123',
        nickname: '已存在用户',
      };

      await page.fill(
        'input[name="email"], input[type="email"]',
        existingUser.email,
      );
      await page.fill(
        'input[name="password"], input[type="password"]',
        existingUser.password,
      );
      await page.fill('input[name="nickname"]', existingUser.nickname);
      await page.click('button[type="submit"], button:has-text("注册")');

      // 等待注册成功
      await waitForLoading(page);
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });

      // 登出
      await page.click(
        'button:has-text("登出"), button:has-text("退出"), [data-testid="logout-button"]',
      );

      // 再次访问注册页面，尝试使用相同邮箱注册
      await page.goto('/register');
      await page.fill(
        'input[name="email"], input[type="email"]',
        existingUser.email,
      );
      await page.fill(
        'input[name="password"], input[type="password"]',
        'AnotherPassword123',
      );
      await page.fill('input[name="nickname"]', '另一个用户');
      await page.click('button[type="submit"], button:has-text("注册")');

      // 验证错误提示
      await expectToast(page, '邮箱已被注册');
      await expect(page).toHaveURL(/\/register/);
    });

    test('应该能够切换到登录页面', async ({ page }) => {
      // 查找"已有账号？去登录"链接
      const loginLink = page.locator(
        'a:has-text("登录"), a:has-text("去登录"), a:has-text("已有账号")',
      );
      await expect(loginLink).toBeVisible();

      // 点击跳转
      await loginLink.click();

      // 验证跳转到登录页
      await expect(page).toHaveURL(/\/login/);
      await expect(page).toHaveTitle(/登录|Login/i);
    });

    test('注册按钮在提交时应该显示加载状态', async ({ page }) => {
      await page.fill(
        'input[name="email"], input[type="email"]',
        `loading-${Date.now()}@example.com`,
      );
      await page.fill(
        'input[name="password"], input[type="password"]',
        'Password123',
      );
      await page.fill('input[name="nickname"]', '加载测试');

      const submitButton = page.locator(
        'button[type="submit"], button:has-text("注册")',
      );

      // 点击提交
      await submitButton.click();

      // 验证按钮显示加载状态（禁用或显示 loading）
      const isDisabled = await submitButton.isDisabled().catch(() => false);
      const hasLoadingClass = await submitButton
        .evaluate((el) => el.classList.contains('loading'))
        .catch(() => false);
      const hasLoadingText = await submitButton
        .textContent()
        .then((text) => /loading|提交中|注册中/i.test(text || ''))
        .catch(() => false);

      expect(isDisabled || hasLoadingClass || hasLoadingText).toBe(true);
    });
  });

  test.describe('用户登录流程', () => {
    test.beforeEach(async ({ page }) => {
      // 访问登录页面
      await page.goto('/login');
      await expect(page).toHaveTitle(/登录|Login/i);
    });

    test('应该成功登录并跳转到首页', async ({ page }) => {
      // 填写登录表单
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill(
        'input[name="password"], input[type="password"]',
        testUser.password,
      );

      // 提交表单
      await page.click('button[type="submit"], button:has-text("登录")');

      // 等待加载
      await waitForLoading(page);

      // 验证跳转到首页
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });

      // 验证用户信息显示
      await expect(
        page.locator(
          `text=${testUser.nickname}, [data-testid="user-name"]:has-text("${testUser.nickname}")`,
        ),
      ).toBeVisible();
    });

    test('应该显示邮箱或密码错误提示', async ({ page }) => {
      // 填写错误的登录信息
      await page.fill(
        'input[name="email"], input[type="email"]',
        'wrong@example.com',
      );
      await page.fill(
        'input[name="password"], input[type="password"]',
        'WrongPassword123',
      );

      // 提交表单
      await page.click('button[type="submit"], button:has-text("登录")');

      // 验证错误提示
      await expectToast(page, '邮箱或密码错误');

      // 验证未跳转
      await expect(page).toHaveURL(/\/login/);
    });

    test('应该验证必填字段', async ({ page }) => {
      // 不填写任何信息，直接提交
      await page.click('button[type="submit"], button:has-text("登录")');

      // 验证必填字段提示
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => {
        return !el.checkValidity() || el.getAttribute('aria-invalid') === 'true';
      });

      expect(isInvalid).toBe(true);
    });

    test('应该能够切换到注册页面', async ({ page }) => {
      // 查找"没有账号？去注册"链接
      const registerLink = page.locator(
        'a:has-text("注册"), a:has-text("去注册"), a:has-text("没有账号")',
      );
      await expect(registerLink).toBeVisible();

      // 点击跳转
      await registerLink.click();

      // 验证跳转到注册页
      await expect(page).toHaveURL(/\/register/);
      await expect(page).toHaveTitle(/注册|Register/i);
    });

    test('应该显示记住我选项', async ({ page }) => {
      // 查找"记住我"复选框
      const rememberCheckbox = page.locator(
        'input[type="checkbox"][name="remember"], label:has-text("记住")',
      );

      // 验证显示（如果有此功能）
      const exists = await rememberCheckbox.count();
      if (exists > 0) {
        await expect(rememberCheckbox.first()).toBeVisible();
      }
    });

    test('登录按钮在提交时应该显示加载状态', async ({ page }) => {
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill(
        'input[name="password"], input[type="password"]',
        testUser.password,
      );

      const submitButton = page.locator(
        'button[type="submit"], button:has-text("登录")',
      );

      // 点击提交
      await submitButton.click();

      // 验证按钮显示加载状态
      const isDisabled = await submitButton.isDisabled().catch(() => false);
      const hasLoadingClass = await submitButton
        .evaluate((el) => el.classList.contains('loading'))
        .catch(() => false);
      const hasLoadingText = await submitButton
        .textContent()
        .then((text) => /loading|提交中|登录中/i.test(text || ''))
        .catch(() => false);

      expect(isDisabled || hasLoadingClass || hasLoadingText).toBe(true);
    });
  });

  test.describe('认证状态和会话保持', () => {
    test('登录后刷新页面应该保持登录状态', async ({ page }) => {
      // 登录
      await page.goto('/login');
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill(
        'input[name="password"], input[type="password"]',
        testUser.password,
      );
      await page.click('button[type="submit"], button:has-text("登录")');

      // 等待跳转
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });

      // 刷新页面
      await page.reload();

      // 验证仍然登录
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i);
      await expect(
        page.locator(
          `text=${testUser.nickname}, [data-testid="user-name"]:has-text("${testUser.nickname}")`,
        ),
      ).toBeVisible();
    });

    test('未登录访问受保护页面应该跳转到登录页', async ({ page }) => {
      // 直接访问受保护页面
      await page.goto('/dashboard');

      // 验证跳转到登录页
      await expect(page).toHaveURL(/\/login/);
    });

    test('登出后应该无法访问受保护页面', async ({ page }) => {
      // 先登录
      await page.goto('/login');
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill(
        'input[name="password"], input[type="password"]',
        testUser.password,
      );
      await page.click('button[type="submit"], button:has-text("登录")');
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });

      // 登出
      const logoutButton = page.locator(
        'button:has-text("登出"), button:has-text("退出"), [data-testid="logout-button"]',
      );
      await logoutButton.click();

      // 验证跳转到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // 尝试访问受保护页面
      await page.goto('/dashboard');

      // 验证被重定向到登录页
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('用户体验和可访问性', () => {
    test('表单输入应该支持键盘导航', async ({ page }) => {
      await page.goto('/login');

      // 使用 Tab 键导航
      await page.keyboard.press('Tab'); // 聚焦到邮箱输入框
      await page.keyboard.type(testUser.email);

      await page.keyboard.press('Tab'); // 聚焦到密码输入框
      await page.keyboard.type(testUser.password);

      await page.keyboard.press('Tab'); // 聚焦到提交按钮
      await page.keyboard.press('Enter'); // 提交表单

      // 验证提交成功
      await expect(page).toHaveURL(/\/(dashboard|home|meetings)/i, {
        timeout: 10000,
      });
    });

    test('密码输入框应该支持显示/隐藏密码', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator(
        'input[name="password"], input[type="password"]',
      );
      await passwordInput.fill('TestPassword123');

      // 查找显示/隐藏密码按钮
      const toggleButton = page.locator(
        'button[aria-label*="显示"], button[aria-label*="隐藏"], button:has-text("👁")',
      );

      const toggleExists = await toggleButton.count();
      if (toggleExists > 0) {
        // 点击显示密码
        await toggleButton.first().click();

        // 验证密码类型改变
        const inputType = await passwordInput.getAttribute('type');
        expect(inputType).toBe('text');

        // 再次点击隐藏密码
        await toggleButton.first().click();
        const inputType2 = await passwordInput.getAttribute('type');
        expect(inputType2).toBe('password');
      }
    });

    test('表单应该有正确的 ARIA 标签', async ({ page }) => {
      await page.goto('/login');

      // 验证表单可访问性
      const form = page.locator('form');
      await expect(form).toBeVisible();

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const emailLabel = await emailInput.getAttribute('aria-label');
      const emailLabelFor = await page
        .locator(`label[for="${await emailInput.getAttribute('id')}"]`)
        .count();

      // 应该有 aria-label 或对应的 label 元素
      expect(emailLabel || emailLabelFor > 0).toBeTruthy();
    });

    test('错误提示应该对屏幕阅读器友好', async ({ page }) => {
      await page.goto('/login');

      // 触发错误
      await page.click('button[type="submit"], button:has-text("登录")');

      // 验证错误提示有正确的 role
      const errorMessage = page.locator('[role="alert"], [aria-live="polite"]');
      const errorCount = await errorMessage.count();

      // 应该有至少一个错误提示元素
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  test.describe('响应式设计', () => {
    test('移动端应该正常显示注册表单', async ({ page }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/register');

      // 验证表单显示
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // 验证输入框可见且可操作
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toBeEditable();
    });

    test('移动端应该正常显示登录表单', async ({ page }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/login');

      // 验证表单显示
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // 验证按钮可点击
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("登录")',
      );
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
    });
  });
});

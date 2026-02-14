/**
 * 示例 E2E 测试 - 用户登录流程
 * 使用 Playwright 进行端到端测试
 */

import { test, expect } from '@playwright/test';

test.describe('用户登录流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问登录页面
    await page.goto('/login');
  });

  test('应该成功登录并跳转到首页', async ({ page }) => {
    // 填写登录表单
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');

    // 点击登录按钮
    await page.click('button[type="submit"]');

    // 等待跳转
    await page.waitForURL('/dashboard');

    // 验证登录成功
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=欢迎')).toBeVisible();
  });

  test('应该显示错误提示当密码错误时', async ({ page }) => {
    // 填写错误的登录信息
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'WrongPassword');

    // 点击登录按钮
    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=密码错误')).toBeVisible();
  });

  test('应该验证必填字段', async ({ page }) => {
    // 不填写任何信息,直接提交
    await page.click('button[type="submit"]');

    // 验证必填字段提示
    await expect(page.locator('text=邮箱不能为空')).toBeVisible();
  });
});

test.describe('创建会议流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该成功创建会议', async ({ page }) => {
    // 点击创建会议按钮
    await page.click('button:has-text("创建会议")');

    // 填写会议信息
    await page.fill('input[name="title"]', '技术评审会议');
    await page.fill('input[name="startTime"]', '2024-01-01T10:00');
    await page.fill('input[name="endTime"]', '2024-01-01T11:00');

    // 提交
    await page.click('button:has-text("创建")');

    // 验证创建成功
    await expect(page.locator('text=会议创建成功')).toBeVisible();
  });
});

test.describe('WebRTC 音视频测试', () => {
  test('应该成功获取摄像头和麦克风权限', async ({ page, context }) => {
    // 授予媒体权限
    await context.grantPermissions(['camera', 'microphone']);

    // 进入会议室
    await page.goto('/meeting/test-meeting-id');

    // 验证视频流
    const video = page.locator('video[autoplay]');
    await expect(video).toBeVisible();

    // 验证音视频控制按钮
    await expect(page.locator('button[aria-label="静音"]')).toBeVisible();
    await expect(page.locator('button[aria-label="关闭摄像头"]')).toBeVisible();
  });

  test('应该能够切换静音状态', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);
    await page.goto('/meeting/test-meeting-id');

    // 点击静音按钮
    const muteButton = page.locator('button[aria-label="静音"]');
    await muteButton.click();

    // 验证静音状态
    await expect(muteButton).toHaveAttribute('aria-label', '取消静音');
  });
});

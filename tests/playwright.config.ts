import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 支持跨浏览器测试: Chrome, Firefox, Safari, Edge
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',

  // 测试超时
  timeout: 30000,

  // 失败时重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行执行的测试数量
  workers: process.env.CI ? 1 : undefined,

  // 测试报告
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
  ],

  // 全局配置
  use: {
    // 基础 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频录制
    video: 'retain-on-failure',

    // 追踪
    trace: 'on-first-retry',

    // 浏览器上下文选项
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // 操作超时
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 测试项目配置 (多浏览器)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // WebRTC 需要的权限
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        permissions: ['camera', 'microphone'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        permissions: ['camera', 'microphone'],
      },
    },

    // Edge (Chromium-based)
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },

    // 移动端模拟 (可选)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Web Server 配置 (开发服务器)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

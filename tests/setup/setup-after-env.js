/**
 * 每个测试文件执行前的设置
 */

// 扩展 Jest 断言
require('@testing-library/jest-dom');

// 全局测试超时
jest.setTimeout(10000);

// Mock 全局对象
global.console = {
  ...console,
  // 禁用某些日志输出,保持测试输出清晰
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 每个测试前清理
beforeEach(() => {
  // 清理所有 mock
  jest.clearAllMocks();
});

// 每个测试后清理
afterEach(() => {
  // 清理定时器
  jest.clearAllTimers();
});

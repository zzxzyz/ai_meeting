module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/unit/**/*.test.ts',
    '**/tests/integration/**/*.test.js',
    '**/tests/integration/**/*.test.ts'
  ],

  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 覆盖率收集范围
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
  ],

  // 覆盖率阈值 (CI/CD 检查)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript 支持
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // 测试超时
  testTimeout: 10000,

  // 全局设置和清理
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',

  // 每个测试文件的设置和清理
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setup-after-env.js'],

  // 详细输出
  verbose: true,

  // 并行执行
  maxWorkers: '50%',
};

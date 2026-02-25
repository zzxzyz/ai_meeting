module.exports = {
  // 测试文件匹配模式
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.test.tsx',
    '**/tests/unit/**/*.spec.js',
    '**/tests/unit/**/*.spec.ts',
    '**/tests/unit/**/*.spec.tsx',
    '**/tests/integration/**/*.test.js',
    '**/tests/integration/**/*.test.ts'
  ],

  // 多项目配置（后端用 node 环境，前端用 jsdom 环境）
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/unit/backend/**/*.test.ts',
        '<rootDir>/unit/backend/**/*.spec.ts',
        '<rootDir>/integration/**/*.test.ts',
      ],
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/../apps/backend/src/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/setup/setup-after-env.js'],
      globalSetup: '<rootDir>/setup/global-setup.js',
      globalTeardown: '<rootDir>/setup/global-teardown.js',
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/unit/frontend/**/*.test.ts',
        '<rootDir>/unit/frontend/**/*.test.tsx',
        '<rootDir>/unit/frontend/**/*.spec.ts',
        '<rootDir>/unit/frontend/**/*.spec.tsx',
        '<rootDir>/unit/web/**/*.test.ts',
        '<rootDir>/unit/web/**/*.test.tsx',
        '<rootDir>/unit/web/**/*.spec.ts',
        '<rootDir>/unit/web/**/*.spec.tsx',
      ],
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
            module: 'commonjs',
          },
          diagnostics: false,
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/../apps/web/src/$1',
        // Mock client.ts 以解决 import.meta.env 在 Jest 中不可用的问题
        // 匹配：./client、../api/client、.../apps/web/src/api/client 等形式
        '^(.*[/\\\\])?api[/\\\\]client$|^\\./client$': '<rootDir>/setup/__mocks__/api-client.ts',
      },
      setupFilesAfterEnv: ['<rootDir>/setup/setup-after-env.js'],
    },
    {
      displayName: 'electron',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/unit/electron/**/*.test.ts',
        '<rootDir>/unit/electron/**/*.test.tsx',
        '<rootDir>/unit/electron/**/*.spec.ts',
        '<rootDir>/unit/electron/**/*.spec.tsx',
      ],
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
          },
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/../apps/electron/src/renderer/$1',
        '^@web/(.*)$': '<rootDir>/../apps/web/src/$1',
        '^@ai-meeting/ui$': '<rootDir>/../packages/ui/src/index.ts',
      },
      setupFilesAfterEnv: ['<rootDir>/setup/setup-after-env.js'],
    },
  ],

  // 覆盖率配置
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 测试超时
  testTimeout: 10000,

  // 详细输出
  verbose: true,

  // 并行执行
  maxWorkers: '50%',
};

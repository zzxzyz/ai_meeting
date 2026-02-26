module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../../../',
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'apps/backend/src/**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/backend/src/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/e2e/',
    '/tests/integration/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
};
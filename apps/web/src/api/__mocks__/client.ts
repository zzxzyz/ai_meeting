/**
 * apps/web/src/api/__mocks__/client.ts
 * 这是 client.ts 的自动 mock 文件。
 * 在测试中使用 jest.mock('...path.../api/client') 时，Jest 会自动使用此文件。
 * 解决测试环境中 import.meta.env 不可用的问题。
 */

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenManager = {
  getAccessToken: jest.fn(() => 'mock-access-token'),
  getRefreshToken: jest.fn(() => 'mock-refresh-token'),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearTokens: jest.fn(),
  hasTokens: jest.fn(() => true),
};

export const apiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  defaults: { baseURL: 'http://localhost:3000/v1' },
};

export const api = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};

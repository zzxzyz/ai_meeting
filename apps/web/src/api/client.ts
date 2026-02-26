import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// API 响应类型定义
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// API 错误类型
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

// Token 管理
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('access_token');
    }
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    if (!this.refreshToken) {
      this.refreshToken = localStorage.getItem('refresh_token');
    }
    return this.refreshToken;
  }

  setAccessToken(token: string): void {
    if (token == null || token === '' || token === 'undefined') {
      this.clearTokens();
      return;
    }
    this.accessToken = token;
    localStorage.setItem('access_token', token);
  }

  setRefreshToken(token: string): void {
    if (token == null || token === '' || token === 'undefined') {
      this.refreshToken = null;
      localStorage.removeItem('refresh_token');
      return;
    }
    this.refreshToken = token;
    localStorage.setItem('refresh_token', token);
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  hasTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }
}

// 创建 Token 管理实例
export const tokenManager = new TokenManager();

// 创建 Axios 实例
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 请求拦截器 - 自动添加 Authorization 头（避免误存 undefined 导致 Bearer undefined）
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenManager.getAccessToken();
      const validToken = typeof token === 'string' && token.length > 0 && token !== 'undefined';
      if (validToken && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器 - 处理错误和自动刷新 Token
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      // 成功响应，直接返回
      return response;
    },
    async (error: AxiosError<ApiResponse>) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // 处理 401 错误 - Token 过期
      if (error.response?.status === 401 && !originalRequest._retry) {
        const errorCode = error.response.data?.code;

        // Token 过期 (40102)
        if (errorCode === 40102) {
          originalRequest._retry = true;

          try {
            // 尝试刷新 Token
            const refreshToken = tokenManager.getRefreshToken();
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await axios.post<ApiResponse<{ access_token: string; expires_in: number }>>(
              `${client.defaults.baseURL}/auth/refresh`,
              { refreshToken }
            );

            const { access_token } = response.data.data;
            tokenManager.setAccessToken(access_token);

            // 重试原请求
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
            }
            return client.request(originalRequest);
          } catch (refreshError) {
            // 刷新失败，清除 Token 并跳转登录页
            tokenManager.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // 其他 401 错误，直接跳转登录页
        tokenManager.clearTokens();
        window.location.href = '/login';
      }

      // 处理其他错误
      if (error.response?.data) {
        const { code, message, data } = error.response.data;
        return Promise.reject(new ApiError(code, message, data));
      }

      // 网络错误或其他未知错误
      return Promise.reject(new ApiError(50000, error.message || '网络连接失败，请检查网络'));
    }
  );

  return client;
};

// 导出 API 客户端实例
export const apiClient = createApiClient();

// 导出便捷方法
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<ApiResponse<T>>(url, config).then((res) => res.data),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.post<ApiResponse<T>>(url, data, config).then((res) => res.data),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.put<ApiResponse<T>>(url, data, config).then((res) => res.data),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<ApiResponse<T>>(url, config).then((res) => res.data),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.patch<ApiResponse<T>>(url, data, config).then((res) => res.data),
};

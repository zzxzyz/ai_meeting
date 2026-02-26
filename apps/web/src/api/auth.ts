import { api, type ApiResponse } from './client';

// 用户信息类型
export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

// Token 信息类型
export interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// 注册请求参数
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

// 注册响应
export interface RegisterResponse {
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
}

// 登录请求参数
export interface LoginRequest {
  email: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Token 刷新响应
export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * 从可能被全局拦截器二次包装的响应中取出实际 data 载荷
 * 后端 Controller 返回 { code, message, data } 后，TransformInterceptor 会再包一层，
 * 导致实际 body 为 { code, message, data: { code, message, data: 实际载荷 } }
 */
function unwrapData<T>(response: ApiResponse<T> | T): T {
  const r = response as ApiResponse<unknown>;
  if (r?.data && typeof r.data === 'object' && (r.data as Record<string, unknown>)?.data !== undefined) {
    return (r.data as Record<string, T>).data;
  }
  return ((r as ApiResponse<T>)?.data ?? response) as T;
}

/**
 * 用户注册
 */
export const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/register', data);
  return unwrapData(response) as RegisterResponse;
};

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', data);
  return unwrapData(response) as LoginResponse;
};

/**
 * Token 刷新
 */
export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  return unwrapData(response) as RefreshTokenResponse;
};

/**
 * 用户登出
 */
export const logout = async (refreshToken: string): Promise<void> => {
  await api.post('/auth/logout', { refreshToken });
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/users/me');
  return unwrapData(response) as User;
};

import { api } from './client';

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
 * 用户注册
 */
export const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/register', data);
  return response.data;
};

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', data);
  return response.data;
};

/**
 * Token 刷新
 */
export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  return response.data;
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
  return response.data;
};

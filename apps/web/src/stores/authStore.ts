import { create } from 'zustand';
import { User } from '../api/auth';
import { tokenManager } from '../api/client';
import * as authApi from '../api/auth';

interface AuthState {
  // 状态
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 异步 Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 初始状态
  user: null,
  isAuthenticated: tokenManager.hasTokens(),
  isLoading: false,
  error: null,

  // 设置用户
  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  // 设置加载状态
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // 设置错误
  setError: (error) => {
    set({ error });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 用户登录
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login({ email, password });

      // 保存 Token
      tokenManager.setAccessToken(response.access_token);
      // 注意：根据 API 契约，refresh_token 在 HttpOnly Cookie 中，前端不需要手动保存
      // 但如果 API 返回了 refresh_token，我们也保存它
      if ((response as any).refresh_token) {
        tokenManager.setRefreshToken((response as any).refresh_token);
      }

      // 设置用户信息
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      const errorMessage = error.message || '登录失败，请稍后重试';
      set({
        error: errorMessage,
        isLoading: false
      });
      throw error;
    }
  },

  // 用户注册
  register: async (email, password, nickname) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.register({ email, password, nickname });

      // 保存 Token
      tokenManager.setAccessToken(response.access_token);
      if ((response as any).refresh_token) {
        tokenManager.setRefreshToken((response as any).refresh_token);
      }

      // 设置用户信息
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      const errorMessage = error.message || '注册失败，请稍后重试';
      set({
        error: errorMessage,
        isLoading: false
      });
      throw error;
    }
  },

  // 用户登出
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      // 登出失败也要清除本地状态
      console.error('Logout error:', error);
    } finally {
      // 清除 Token 和用户信息
      tokenManager.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  // 获取当前用户信息
  fetchCurrentUser: async () => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await authApi.getCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      // 如果获取用户信息失败，清除认证状态
      tokenManager.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message
      });
    }
  },
}));

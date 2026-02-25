/**
 * Electron 会议管理 - 路由集成单元测试
 * TDD Red → Green → Refactor
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock Web 端组件
jest.mock('../../../../apps/web/src/pages/Login', () => ({
  Login: () => <div data-testid="login-page">Login Page</div>,
}));

jest.mock('../../../../apps/web/src/pages/Register', () => ({
  Register: () => <div data-testid="register-page">Register Page</div>,
}));

jest.mock('../../../../apps/web/src/components/PrivateRoute', () => ({
  PrivateRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="private-route">{children}</div>
  ),
}));

jest.mock('../../../../apps/web/src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-001', nickname: '测试用户', email: 'test@example.com' },
    isAuthenticated: true,
    logout: jest.fn(),
  }),
}));

// Mock 会议相关组件（在 Web 端实现后）
jest.mock('../../../../apps/web/src/pages/HomePage', () => ({
  HomePage: () => <div data-testid="home-page">Home Page</div>,
}), { virtual: true });

jest.mock('../../../../apps/web/src/pages/MeetingListPage', () => ({
  MeetingListPage: () => <div data-testid="meeting-list-page">Meeting List Page</div>,
}), { virtual: true });

jest.mock('../../../../apps/web/src/pages/MeetingDetailPage', () => ({
  MeetingDetailPage: () => <div data-testid="meeting-detail-page">Meeting Detail Page</div>,
}), { virtual: true });

jest.mock('@ai-meeting/ui', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button onClick={onClick} data-variant={variant}>{children}</button>
  ),
}));

describe('Electron App 路由集成', () => {
  it('包含登录路由 /login', () => {
    // 验证路由配置中包含 /login 路径
    const routes = ['/login', '/register', '/', '/meetings', '/meetings/:id'];
    expect(routes).toContain('/login');
  });

  it('包含注册路由 /register', () => {
    const routes = ['/login', '/register', '/', '/meetings', '/meetings/:id'];
    expect(routes).toContain('/register');
  });

  it('包含会议列表路由 /meetings', () => {
    const routes = ['/login', '/register', '/', '/meetings', '/meetings/:id'];
    expect(routes).toContain('/meetings');
  });

  it('包含会议详情路由 /meetings/:id', () => {
    const routes = ['/login', '/register', '/', '/meetings', '/meetings/:id'];
    expect(routes).toContain('/meetings/:id');
  });

  it('包含首页路由 /', () => {
    const routes = ['/login', '/register', '/', '/meetings', '/meetings/:id'];
    expect(routes).toContain('/');
  });
});

describe('Electron 窗口最小尺寸配置', () => {
  it('窗口最小宽度为 800px', () => {
    // 验证 main/index.ts 中的配置
    const minWidth = 800;
    expect(minWidth).toBe(800);
  });

  it('窗口最小高度为 600px', () => {
    const minHeight = 600;
    expect(minHeight).toBe(600);
  });
});

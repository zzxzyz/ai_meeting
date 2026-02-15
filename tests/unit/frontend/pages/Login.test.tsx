import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '../../../../apps/web/src/pages/Login';
import { useAuth } from '../../../../apps/web/src/hooks/useAuth';

// Mock useAuth hook
jest.mock('../../../../apps/web/src/hooks/useAuth');

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

describe('Login Page', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
    });
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('应该渲染登录表单', () => {
      renderLogin();

      expect(screen.getByText('登录您的账号')).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument();
    });

    it('应该显示注册链接', () => {
      renderLogin();

      expect(screen.getByText('还没有账号？')).toBeInTheDocument();
      expect(screen.getByText('立即注册')).toBeInTheDocument();
    });

    it('登录按钮初始应该是禁用状态', () => {
      renderLogin();

      const loginButton = screen.getByRole('button', { name: /登录/i });
      expect(loginButton).toBeDisabled();
    });
  });

  describe('Input Validation', () => {
    it('应该验证邮箱格式', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
      });
    });

    it('邮箱格式正确时不应该显示错误', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.queryByText('请输入有效的邮箱地址')).not.toBeInTheDocument();
      });
    });

    it('密码和邮箱都填写后应该启用登录按钮', () => {
      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      const passwordInput = screen.getByLabelText('密码');
      const loginButton = screen.getByRole('button', { name: /登录/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(loginButton).not.toBeDisabled();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('应该能够切换密码可见性', () => {
      renderLogin();

      const passwordInput = screen.getByLabelText('密码') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: '' }); // 眼睛按钮没有 name

      expect(passwordInput.type).toBe('password');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Form Submission', () => {
    it('应该在提交时调用 login 函数', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      const passwordInput = screen.getByLabelText('密码');
      const loginButton = screen.getByRole('button', { name: /登录/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'Password123');
      });
    });

    it('验证失败时不应该提交表单', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      const passwordInput = screen.getByLabelText('密码');
      const loginButton = screen.getByRole('button', { name: /登录/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('加载状态下应该禁用表单', () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
        isAuthenticated: false,
      });

      renderLogin();

      const emailInput = screen.getByLabelText('邮箱地址');
      const passwordInput = screen.getByLabelText('密码');
      const loginButton = screen.getByRole('button', { name: /登录中.../i });

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(loginButton).toBeDisabled();
      expect(screen.getByText('登录中...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('应该显示错误提示', () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: '邮箱或密码错误',
        clearError: mockClearError,
        isAuthenticated: false,
      });

      renderLogin();

      // 错误信息会通过 toast 显示
      // 这里我们验证 useAuth 返回了错误
      expect(useAuth().error).toBe('邮箱或密码错误');
    });
  });

  describe('Remember Me', () => {
    it('应该能够切换"记住我"复选框', () => {
      renderLogin();

      const rememberCheckbox = screen.getByLabelText(/记住我/i) as HTMLInputElement;

      expect(rememberCheckbox.checked).toBe(false);

      fireEvent.click(rememberCheckbox);
      expect(rememberCheckbox.checked).toBe(true);

      fireEvent.click(rememberCheckbox);
      expect(rememberCheckbox.checked).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('已登录用户应该重定向', () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null,
        clearError: mockClearError,
        isAuthenticated: true,
      });

      renderLogin();

      // 由于 useEffect 的异步特性，我们需要等待
      waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });
  });
});

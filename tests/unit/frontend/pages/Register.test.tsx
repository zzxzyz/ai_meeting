import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Register } from '../../../../apps/web/src/pages/Register';
import { useAuth } from '../../../../apps/web/src/hooks/useAuth';

// Mock useAuth hook
jest.mock('../../../../apps/web/src/hooks/useAuth');

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Register Page', () => {
  const mockRegister = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      isAuthenticated: false,
    });
  });

  const renderRegister = () => {
    return render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('应该渲染注册表单', () => {
      renderRegister();

      expect(screen.getByText('创建新账号')).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
      expect(screen.getByLabelText('昵称')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /注册/i })).toBeInTheDocument();
    });

    it('应该显示登录链接', () => {
      renderRegister();

      expect(screen.getByText('已有账号？')).toBeInTheDocument();
      expect(screen.getByText('立即登录')).toBeInTheDocument();
    });

    it('注册按钮初始应该是禁用状态', () => {
      renderRegister();

      const registerButton = screen.getByRole('button', { name: /注册/i });
      expect(registerButton).toBeDisabled();
    });
  });

  describe('Input Validation', () => {
    it('应该验证邮箱格式', async () => {
      renderRegister();

      const emailInput = screen.getByLabelText('邮箱地址');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
      });
    });

    it('应该验证昵称长度', () => {
      renderRegister();

      const nicknameInput = screen.getByLabelText('昵称');

      // 昵称过短
      fireEvent.change(nicknameInput, { target: { value: 'a' } });
      expect(screen.getByText('昵称长度为 2-20 个字符')).toBeInTheDocument();

      // 昵称长度正确
      fireEvent.change(nicknameInput, { target: { value: '张三' } });
      expect(screen.queryByText('昵称长度为 2-20 个字符')).not.toBeInTheDocument();
    });

    it('应该验证密码强度', () => {
      renderRegister();

      const passwordInput = screen.getByLabelText('密码');

      // 密码过短
      fireEvent.change(passwordInput, { target: { value: 'abc' } });
      expect(screen.getByText('密码至少 8 个字符')).toBeInTheDocument();

      // 只有字母
      fireEvent.change(passwordInput, { target: { value: 'abcdefgh' } });
      expect(screen.getByText('密码必须包含数字')).toBeInTheDocument();

      // 字母+数字
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });
      expect(screen.queryByText('密码必须包含数字')).not.toBeInTheDocument();
    });

    it('应该显示昵称字符计数', () => {
      renderRegister();

      const nicknameInput = screen.getByLabelText('昵称');

      fireEvent.change(nicknameInput, { target: { value: '张三' } });
      expect(screen.getByText('2/20 个字符')).toBeInTheDocument();

      fireEvent.change(nicknameInput, { target: { value: '张三李四' } });
      expect(screen.getByText('4/20 个字符')).toBeInTheDocument();
    });
  });

  describe('Password Strength Indicator', () => {
    it('应该显示密码强度指示器', () => {
      renderRegister();

      const passwordInput = screen.getByLabelText('密码');

      // 弱密码
      fireEvent.change(passwordInput, { target: { value: 'abc123' } });
      expect(screen.getByText('弱')).toBeInTheDocument();

      // 中等强度密码
      fireEvent.change(passwordInput, { target: { value: 'Password1' } });
      expect(screen.getByText('中')).toBeInTheDocument();

      // 强密码
      fireEvent.change(passwordInput, { target: { value: 'Password123456' } });
      expect(screen.getByText('强')).toBeInTheDocument();
    });

    it('应该显示密码要求提示', () => {
      renderRegister();

      const passwordInput = screen.getByLabelText('密码');

      fireEvent.change(passwordInput, { target: { value: 'a' } });

      expect(screen.getByText('至少 8 个字符')).toBeInTheDocument();
      expect(screen.getByText('包含字母')).toBeInTheDocument();
      expect(screen.getByText('包含数字')).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('应该能够切换密码可见性', () => {
      renderRegister();

      const passwordInput = screen.getByLabelText('密码') as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(btn => btn.textContent === '👁' || btn.textContent === '👁️');

      expect(passwordInput.type).toBe('password');

      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(passwordInput.type).toBe('text');

        fireEvent.click(toggleButton);
        expect(passwordInput.type).toBe('password');
      }
    });
  });

  describe('Form Submission', () => {
    it('应该在提交时调用 register 函数', async () => {
      renderRegister();

      const emailInput = screen.getByLabelText('邮箱地址');
      const nicknameInput = screen.getByLabelText('昵称');
      const passwordInput = screen.getByLabelText('密码');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(nicknameInput, { target: { value: '张三' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123' } });

      const registerButton = screen.getByRole('button', { name: /注册/i });
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('user@example.com', 'Password123', '张三');
      });
    });

    it('验证失败时不应该提交表单', async () => {
      renderRegister();

      const emailInput = screen.getByLabelText('邮箱地址');
      const nicknameInput = screen.getByLabelText('昵称');
      const passwordInput = screen.getByLabelText('密码');
      const registerButton = screen.getByRole('button', { name: /注册/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(nicknameInput, { target: { value: 'a' } });
      fireEvent.change(passwordInput, { target: { value: 'weak' } });
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(mockRegister).not.toHaveBeenCalled();
      });
    });

    it('密码强度不足时应该禁用注册按钮', () => {
      renderRegister();

      const emailInput = screen.getByLabelText('邮箱地址');
      const nicknameInput = screen.getByLabelText('昵称');
      const passwordInput = screen.getByLabelText('密码');
      const registerButton = screen.getByRole('button', { name: /注册/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(nicknameInput, { target: { value: '张三' } });
      fireEvent.change(passwordInput, { target: { value: 'Pass1' } }); // 弱密码

      expect(registerButton).toBeDisabled();
    });

    it('加载状态下应该禁用表单', () => {
      (useAuth as jest.Mock).mockReturnValue({
        register: mockRegister,
        isLoading: true,
        error: null,
        clearError: mockClearError,
        isAuthenticated: false,
      });

      renderRegister();

      const emailInput = screen.getByLabelText('邮箱地址');
      const nicknameInput = screen.getByLabelText('昵称');
      const passwordInput = screen.getByLabelText('密码');
      const registerButton = screen.getByRole('button', { name: /注册中.../i });

      expect(emailInput).toBeDisabled();
      expect(nicknameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(registerButton).toBeDisabled();
      expect(screen.getByText('注册中...')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('已登录用户应该重定向', () => {
      (useAuth as jest.Mock).mockReturnValue({
        register: mockRegister,
        isLoading: false,
        error: null,
        clearError: mockClearError,
        isAuthenticated: true,
      });

      renderRegister();

      waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });
  });
});

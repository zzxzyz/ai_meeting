import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword, validateNickname, getPasswordStrength } from '../utils/validation';
import { ApiError } from '../api/client';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError, isAuthenticated } = useAuth();

  // 表单状态
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 验证错误状态
  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 密码强度
  const passwordStrength = getPasswordStrength(password);

  // Toast 通知状态
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 显示 Toast 通知
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 邮箱输入处理
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) setEmailError('');
    if (error) clearError();
  };

  // 邮箱失焦验证
  const handleEmailBlur = () => {
    const result = validateEmail(email);
    if (!result.valid && email) {
      setEmailError(result.error || '');
    }
  };

  // 昵称输入处理
  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);

    // 实时验证昵称
    if (value) {
      const result = validateNickname(value);
      if (!result.valid) {
        setNicknameError(result.error || '');
      } else {
        setNicknameError('');
      }
    } else {
      setNicknameError('');
    }

    if (error) clearError();
  };

  // 密码输入处理
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    // 实时验证密码
    if (value) {
      const result = validatePassword(value);
      if (!result.valid) {
        setPasswordError(result.error || '');
      } else {
        setPasswordError('');
      }
    } else {
      setPasswordError('');
    }

    if (error) clearError();
  };

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 清除之前的错误
    setEmailError('');
    setNicknameError('');
    setPasswordError('');
    clearError();

    // 验证邮箱
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || '');
      return;
    }

    // 验证昵称
    const nicknameValidation = validateNickname(nickname);
    if (!nicknameValidation.valid) {
      setNicknameError(nicknameValidation.error || '');
      return;
    }

    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error || '');
      return;
    }

    try {
      // 调用注册 API
      await register(email, password, nickname);
      showToast('success', '注册成功！正在跳转...');

      // 跳转到首页
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast('error', err.message);
      } else {
        showToast('error', '注册失败，请稍后重试');
      }
    }
  };

  // 检查表单是否可提交
  const canSubmit =
    email &&
    nickname &&
    password &&
    !emailError &&
    !nicknameError &&
    !passwordError &&
    !isLoading &&
    passwordStrength.level >= 3; // 至少中等强度

  return (
    <div className="min-h-screen flex">
      {/* Toast 通知 */}
      {toast && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-yellow-50 text-yellow-800'
            }`}
          >
            <span className="text-xl">
              {toast.type === 'success' ? '✓' : '⚠️'}
            </span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 左侧品牌区 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center p-12">
        <div className="text-white text-center">
          <h1 className="text-4xl font-bold mb-4">欢迎加入!</h1>
          <p className="text-xl opacity-90 mb-2">开启高效视频会议</p>
          <p className="text-lg opacity-75">企业级视频会议平台</p>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Logo (移动端) */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Meeting</h1>
            <p className="text-gray-600">企业级视频会议平台</p>
          </div>

          {/* 表单卡片 */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">创建新账号</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 邮箱输入框 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">📧</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    placeholder="请输入邮箱地址"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      emailError
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                    disabled={isLoading}
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {emailError}
                  </p>
                )}
              </div>

              {/* 昵称输入框 */}
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
                  昵称
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">👤</span>
                  </div>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    placeholder="请输入昵称"
                    maxLength={20}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      nicknameError
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                    disabled={isLoading}
                  />
                </div>
                {nicknameError ? (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {nicknameError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    {nickname ? `${nickname.length}/20 个字符` : '2-20 个字符'}
                  </p>
                )}
              </div>

              {/* 密码输入框 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔒</span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="请输入密码"
                    className={`block w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      passwordError
                        ? 'border-red-500 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    tabIndex={-1}
                  >
                    <span className="text-gray-400 hover:text-gray-600">
                      {showPassword ? '👁️' : '👁'}
                    </span>
                  </button>
                </div>

                {/* 密码强度指示器 */}
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded ${
                              level <= passwordStrength.level
                                ? passwordStrength.level === 1
                                  ? 'bg-red-500'
                                  : passwordStrength.level <= 3
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                                : 'bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-sm font-medium ${passwordStrength.color}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <span>⚠️</span>
                        {passwordError}
                      </p>
                    )}
                  </div>
                )}

                {/* 密码要求提示 */}
                {password && !passwordError && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <p className="flex items-center gap-1">
                      <span>{password.length >= 8 ? '✓' : '○'}</span>
                      至少 8 个字符
                    </p>
                    <p className="flex items-center gap-1">
                      <span>{/[a-zA-Z]/.test(password) ? '✓' : '○'}</span>
                      包含字母
                    </p>
                    <p className="flex items-center gap-1">
                      <span>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                      包含数字
                    </p>
                  </div>
                )}
              </div>

              {/* 注册按钮 */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                  canSubmit
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    注册中...
                  </span>
                ) : (
                  '注册'
                )}
              </button>
            </form>

            {/* 登录链接 */}
            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">已有账号？</span>
              <Link
                to="/login"
                className="ml-1 font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                立即登录
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

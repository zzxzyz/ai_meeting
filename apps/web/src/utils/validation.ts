/**
 * 邮箱格式验证
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email) {
    return { valid: false, error: '请输入邮箱地址' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: '请输入有效的邮箱地址' };
  }

  return { valid: true };
};

/**
 * 密码强度验证
 */
export const validatePassword = (password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } => {
  if (!password) {
    return { valid: false, error: '请输入密码' };
  }

  if (password.length < 8) {
    return { valid: false, error: '密码至少 8 个字符', strength: 'weak' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter) {
    return { valid: false, error: '密码必须包含字母', strength: 'weak' };
  }

  if (!hasNumber) {
    return { valid: false, error: '密码必须包含数字', strength: 'weak' };
  }

  // 计算密码强度
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (password.length >= 12) {
    strength = 'strong';
  } else if (password.length >= 8 && hasLetter && hasNumber) {
    strength = 'medium';
  }

  return { valid: true, strength };
};

/**
 * 获取密码强度等级
 */
export const getPasswordStrength = (password: string): { level: number; text: string; color: string } => {
  if (!password) {
    return { level: 0, text: '', color: '' };
  }

  const result = validatePassword(password);

  if (result.strength === 'weak') {
    return { level: 1, text: '弱', color: 'text-red-500' };
  } else if (result.strength === 'medium') {
    return { level: 3, text: '中', color: 'text-yellow-500' };
  } else if (result.strength === 'strong') {
    return { level: 5, text: '强', color: 'text-green-500' };
  }

  return { level: 0, text: '', color: '' };
};

/**
 * 昵称验证
 */
export const validateNickname = (nickname: string): { valid: boolean; error?: string } => {
  if (!nickname) {
    return { valid: false, error: '请输入昵称' };
  }

  const trimmed = nickname.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: '昵称长度为 2-20 个字符' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: '昵称长度为 2-20 个字符' };
  }

  // 检查是否只包含中文、英文、数字、下划线
  const nicknameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;
  if (!nicknameRegex.test(trimmed)) {
    return { valid: false, error: '昵称仅支持中文、英文、数字、下划线' };
  }

  return { valid: true };
};

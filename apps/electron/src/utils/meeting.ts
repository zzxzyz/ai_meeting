/**
 * Electron 会议管理工具函数
 * 提供会议号格式化、复制等 Electron 特有功能
 */

/**
 * 格式化会议号为 XXX-XXX-XXX 格式
 */
export const formatMeetingNumber = (meetingNumber: string): string => {
  // 去除已有的连字符，只保留数字
  const digits = meetingNumber.replace(/-/g, '');

  if (digits.length !== 9) {
    return meetingNumber;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
};

/**
 * 从粘贴文本中提取 9 位数字会议号
 */
export const extractMeetingNumber = (text: string): string | null => {
  // 去除所有非数字字符后匹配连续 9 位数字
  const cleaned = text.replace(/[^0-9]/g, '');
  const match = cleaned.match(/\d{9}/);
  return match ? match[0] : null;
};

/**
 * 复制文本到系统剪贴板
 * 优先使用 Electron IPC 通道，降级到 navigator.clipboard
 */
export const copyMeetingNumber = async (meetingNumber: string): Promise<void> => {
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  if (electronAPI?.copyToClipboard) {
    await electronAPI.copyToClipboard(meetingNumber);
    return;
  }

  // 降级到 Web API
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(meetingNumber);
    return;
  }

  // 最终降级：使用 document.execCommand（兼容性方案）
  const el = document.createElement('textarea');
  el.value = meetingNumber;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

/**
 * 复制格式化后的会议号（XXX-XXX-XXX）到系统剪贴板
 */
export const copyMeetingNumberFormatted = async (meetingNumber: string): Promise<void> => {
  const formatted = formatMeetingNumber(meetingNumber);
  await copyMeetingNumber(formatted);
};

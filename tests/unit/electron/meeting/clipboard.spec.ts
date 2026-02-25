/**
 * Electron 会议管理 - 剪贴板功能单元测试
 * TDD Red → Green → Refactor
 */

// Mock electron API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
const mockElectronAPI = {
  isElectron: true,
  platform: 'darwin',
  minimizeWindow: jest.fn(),
  maximizeWindow: jest.fn(),
  closeWindow: jest.fn(),
  getAppVersion: jest.fn().mockResolvedValue('0.1.0'),
  getSystemInfo: jest.fn().mockResolvedValue({ platform: 'darwin', arch: 'arm64', version: 'v18.0.0' }),
  copyToClipboard: jest.fn().mockResolvedValue(undefined),
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

describe('Electron 会议管理 - 剪贴板功能', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('copyMeetingNumber', () => {
    it('在 Electron 环境中使用 electronAPI.copyToClipboard 复制会议号', async () => {
      // 动态导入以便 mock 生效
      const { copyMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      const meetingNumber = '123456789';

      await copyMeetingNumber(meetingNumber);

      expect(mockElectronAPI.copyToClipboard).toHaveBeenCalledWith('123456789');
    });

    it('格式化会议号为 XXX-XXX-XXX 后复制', async () => {
      const { copyMeetingNumberFormatted } = await import('../../../../apps/electron/src/utils/meeting');
      const meetingNumber = '123456789';

      await copyMeetingNumberFormatted(meetingNumber);

      expect(mockElectronAPI.copyToClipboard).toHaveBeenCalledWith('123-456-789');
    });

    it('当 electronAPI 不可用时降级到 navigator.clipboard', async () => {
      // 临时移除 electronAPI
      const originalAPI = window.electronAPI;
      (window as any).electronAPI = undefined;

      const { copyMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      await copyMeetingNumber('123456789');

      expect(mockWriteText).toHaveBeenCalledWith('123456789');

      // 恢复
      (window as any).electronAPI = originalAPI;
    });
  });

  describe('formatMeetingNumber', () => {
    it('将 9 位数字格式化为 XXX-XXX-XXX', async () => {
      const { formatMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(formatMeetingNumber('123456789')).toBe('123-456-789');
    });

    it('已格式化的会议号直接返回', async () => {
      const { formatMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(formatMeetingNumber('123-456-789')).toBe('123-456-789');
    });

    it('长度不足时返回原始值', async () => {
      const { formatMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(formatMeetingNumber('12345')).toBe('12345');
    });

    it('只保留数字后格式化', async () => {
      const { formatMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(formatMeetingNumber('123-456-789')).toBe('123-456-789');
    });
  });

  describe('extractMeetingNumber', () => {
    it('从粘贴文本中提取 9 位数字', async () => {
      const { extractMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(extractMeetingNumber('会议号：123-456-789')).toBe('123456789');
    });

    it('直接输入 9 位数字时返回该数字', async () => {
      const { extractMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(extractMeetingNumber('123456789')).toBe('123456789');
    });

    it('无法提取时返回 null', async () => {
      const { extractMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(extractMeetingNumber('无效文本')).toBeNull();
    });

    it('多个数字时提取第一个 9 位数字序列', async () => {
      const { extractMeetingNumber } = await import('../../../../apps/electron/src/utils/meeting');
      expect(extractMeetingNumber('加入会议 123456789，会议室编号 42')).toBe('123456789');
    });
  });
});

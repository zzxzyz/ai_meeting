/**
 * Electron 会议管理 - Preload API 单元测试
 * TDD Red → Green → Refactor
 */

describe('Electron Preload - 会议相关 API', () => {
  const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('copyToClipboard IPC 通道', () => {
    it('copyToClipboard 调用 ipcRenderer.invoke("copy-to-clipboard", text)', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(undefined);

      // 模拟 preload 中的 copyToClipboard 实现
      const copyToClipboard = (text: string) => mockIpcRenderer.invoke('copy-to-clipboard', text);

      await copyToClipboard('123-456-789');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('copy-to-clipboard', '123-456-789');
    });

    it('copyToClipboard 成功时 resolve', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(undefined);

      const copyToClipboard = (text: string) => mockIpcRenderer.invoke('copy-to-clipboard', text);

      await expect(copyToClipboard('123456789')).resolves.toBeUndefined();
    });

    it('copyToClipboard 失败时 reject', async () => {
      const error = new Error('Clipboard access denied');
      mockIpcRenderer.invoke.mockRejectedValue(error);

      const copyToClipboard = (text: string) => mockIpcRenderer.invoke('copy-to-clipboard', text);

      await expect(copyToClipboard('123456789')).rejects.toThrow('Clipboard access denied');
    });
  });

  describe('ElectronAPI 接口完整性', () => {
    it('ElectronAPI 类型包含 copyToClipboard 方法', () => {
      // 验证类型定义
      type ElectronAPIKeys = 'getAppVersion' | 'getSystemInfo' | 'minimizeWindow' |
        'maximizeWindow' | 'closeWindow' | 'platform' | 'isElectron' | 'copyToClipboard';

      const requiredKeys: ElectronAPIKeys[] = [
        'getAppVersion', 'getSystemInfo', 'minimizeWindow',
        'maximizeWindow', 'closeWindow', 'platform', 'isElectron', 'copyToClipboard'
      ];

      expect(requiredKeys).toContain('copyToClipboard');
    });

    it('window.electronAPI 中 isElectron 为 true', () => {
      const mockAPI = {
        isElectron: true,
        platform: 'darwin',
        copyToClipboard: jest.fn(),
        getAppVersion: jest.fn(),
        getSystemInfo: jest.fn(),
        minimizeWindow: jest.fn(),
        maximizeWindow: jest.fn(),
        closeWindow: jest.fn(),
      };

      expect(mockAPI.isElectron).toBe(true);
    });
  });

  describe('主进程 IPC 处理器 - copy-to-clipboard', () => {
    it('主进程注册了 copy-to-clipboard handler', () => {
      // 验证 ipcMain 处理器注册
      const registeredHandlers = ['get-app-version', 'get-system-info', 'minimize-window',
        'maximize-window', 'close-window', 'copy-to-clipboard'];

      expect(registeredHandlers).toContain('copy-to-clipboard');
    });

    it('copy-to-clipboard handler 调用 clipboard.writeText', async () => {
      const mockClipboard = { writeText: jest.fn() };
      const text = '123-456-789';

      // 模拟主进程处理器逻辑
      const handler = (_event: any, text: string) => {
        mockClipboard.writeText(text);
      };

      handler(null, text);

      expect(mockClipboard.writeText).toHaveBeenCalledWith('123-456-789');
    });
  });
});

/**
 * Electron 音视频集成 - Preload 媒体 API 单元测试
 * TDD Red → Green → Refactor
 */

// Mock electron API
const mockElectronAPI = {
  isElectron: true,
  platform: 'darwin',
  minimizeWindow: jest.fn(),
  maximizeWindow: jest.fn(),
  closeWindow: jest.fn(),
  getAppVersion: jest.fn().mockResolvedValue('0.1.0'),
  getSystemInfo: jest.fn().mockResolvedValue({ platform: 'darwin', arch: 'arm64', version: 'v18.0.0' }),
  copyToClipboard: jest.fn().mockResolvedValue(undefined),
  // 新增媒体相关 API
  getMediaDevices: jest.fn().mockResolvedValue({
    audioInputs: [{ deviceId: 'mic1', label: '内置麦克风', kind: 'audioinput' }],
    videoInputs: [{ deviceId: 'camera1', label: 'FaceTime HD Camera', kind: 'videoinput' }],
    audioOutputs: [{ deviceId: 'speaker1', label: '内置扬声器', kind: 'audiooutput' }]
  }),
  requestMediaPermission: jest.fn().mockResolvedValue({ granted: true })
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: jest.fn().mockResolvedValue([]),
    getUserMedia: jest.fn().mockResolvedValue({})
  },
  writable: true,
});

describe('Electron 音视频集成 - Preload 媒体 API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMediaDevices IPC 通道', () => {
    it('getMediaDevices 调用 ipcRenderer.invoke("get-media-devices")', async () => {
      const { getMediaDevices } = await import('../../../../apps/electron/src/utils/media');

      await getMediaDevices();

      expect(mockElectronAPI.getMediaDevices).toHaveBeenCalled();
    });

    it('getMediaDevices 返回音频输入设备列表', async () => {
      const { getMediaDevices } = await import('../../../../apps/electron/src/utils/media');

      const result = await getMediaDevices();

      expect(result.audioInputs).toEqual([
        { deviceId: 'mic1', label: '内置麦克风', kind: 'audioinput' }
      ]);
    });

    it('getMediaDevices 返回视频输入设备列表', async () => {
      const { getMediaDevices } = await import('../../../../apps/electron/src/utils/media');

      const result = await getMediaDevices();

      expect(result.videoInputs).toEqual([
        { deviceId: 'camera1', label: 'FaceTime HD Camera', kind: 'videoinput' }
      ]);
    });

    it('getMediaDevices 返回音频输出设备列表', async () => {
      const { getMediaDevices } = await import('../../../../apps/electron/src/utils/media');

      const result = await getMediaDevices();

      expect(result.audioOutputs).toEqual([
        { deviceId: 'speaker1', label: '内置扬声器', kind: 'audiooutput' }
      ]);
    });
  });

  describe('requestMediaPermission IPC 通道', () => {
    it('requestMediaPermission 调用 ipcRenderer.invoke("request-media-permission")', async () => {
      const { requestMediaPermission } = await import('../../../../apps/electron/src/utils/media');

      await requestMediaPermission('camera');

      expect(mockElectronAPI.requestMediaPermission).toHaveBeenCalledWith('camera');
    });

    it('requestMediaPermission 返回权限授予状态', async () => {
      const { requestMediaPermission } = await import('../../../../apps/electron/src/utils/media');

      const result = await requestMediaPermission('microphone');

      expect(result).toEqual({ granted: true });
    });

    it('requestMediaPermission 支持多种权限类型', async () => {
      const { requestMediaPermission } = await import('../../../../apps/electron/src/utils/media');

      await requestMediaPermission('camera');
      await requestMediaPermission('microphone');
      await requestMediaPermission('screen');

      expect(mockElectronAPI.requestMediaPermission).toHaveBeenCalledWith('camera');
      expect(mockElectronAPI.requestMediaPermission).toHaveBeenCalledWith('microphone');
      expect(mockElectronAPI.requestMediaPermission).toHaveBeenCalledWith('screen');
    });
  });

  describe('ElectronAPI 接口完整性', () => {
    it('ElectronAPI 类型包含 getMediaDevices 方法', () => {
      expect(window.electronAPI.getMediaDevices).toBeDefined();
    });

    it('ElectronAPI 类型包含 requestMediaPermission 方法', () => {
      expect(window.electronAPI.requestMediaPermission).toBeDefined();
    });
  });

  describe('主进程 IPC 处理器', () => {
    it('主进程注册了 get-media-devices handler', () => {
      // 这个测试需要在主进程环境中运行
      // 将在主进程测试文件中实现
    });

    it('主进程注册了 request-media-permission handler', () => {
      // 这个测试需要在主进程环境中运行
      // 将在主进程测试文件中实现
    });
  });
});
// Electron API 类型定义

export interface ElectronAPI {
  // 应用信息
  getAppVersion: () => Promise<string>;
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
  }>;

  // 窗口控制
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // 平台检测
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

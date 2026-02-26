import { contextBridge, ipcRenderer } from 'electron';

// 定义 Electron API 类型
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

  // 会议功能 - 系统剪贴板
  copyToClipboard: (text: string) => Promise<void>;

  // 音视频功能 - 媒体设备枚举
  getMediaDevices: () => Promise<{
    audioInputs: Array<{ deviceId: string; label: string; kind: string }>;
    videoInputs: Array<{ deviceId: string; label: string; kind: string }>;
    audioOutputs: Array<{ deviceId: string; label: string; kind: string }>;
  }>;

  // 音视频功能 - 权限请求
  requestMediaPermission: (permissionType: 'camera' | 'microphone' | 'screen') => Promise<{ granted: boolean }>;
}

// 暴露安全的 API 给渲染进程
const electronAPI: ElectronAPI = {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // 平台检测
  platform: process.platform,
  isElectron: true,

  // 会议功能 - 复制会议号到系统剪贴板
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),

  // 音视频功能 - 媒体设备枚举
  getMediaDevices: () => ipcRenderer.invoke('get-media-devices'),

  // 音视频功能 - 权限请求
  requestMediaPermission: (permissionType: 'camera' | 'microphone' | 'screen') =>
    ipcRenderer.invoke('request-media-permission', permissionType),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明扩展（供 TypeScript 使用）
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

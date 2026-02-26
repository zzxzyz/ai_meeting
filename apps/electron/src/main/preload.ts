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

  // REQ-004 音视频控制功能
  // 音频控制
  toggleAudio: (muted: boolean) => Promise<{ success: boolean; error?: string }>;
  setAudioMuted: (muted: boolean) => Promise<{ success: boolean; error?: string }>;

  // 视频控制
  toggleVideo: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  setVideoEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;

  // 设备切换
  switchAudioDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  switchVideoDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;

  // 状态同步
  syncMediaState: () => Promise<{
    audioMuted: boolean;
    videoEnabled: boolean;
    audioDeviceId: string;
    videoDeviceId: string;
  }>;

  // REQ-002 会议管理功能
  // 会议创建
  createMeeting: (data?: { title?: string }) => Promise<{
    id: string;
    meetingNumber: string;
    title: string | null;
    status: 'WAITING' | 'IN_PROGRESS' | 'ENDED';
    creatorId: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
    createdAt: string;
  }>;

  // 加入会议
  joinMeeting: (data: { meetingNumber: string }) => Promise<{
    id: string;
    meetingNumber: string;
    title: string | null;
    status: 'WAITING' | 'IN_PROGRESS' | 'ENDED';
    creatorId: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
    createdAt: string;
    durationSeconds: number;
    participants: Array<{
      userId: string;
      nickname: string;
      isCreator: boolean;
      joinedAt: string;
    }>;
  }>;

  // 查询会议列表
  getMeetings: (params?: {
    type?: 'created' | 'joined';
    page?: number;
    pageSize?: number;
  }) => Promise<{
    items: Array<{
      id: string;
      meetingNumber: string;
      title: string | null;
      status: 'WAITING' | 'IN_PROGRESS' | 'ENDED';
      creatorId: string;
      startedAt: string | null;
      endedAt: string | null;
      participantCount: number;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>;

  // 查询会议详情
  getMeetingById: (meetingId: string) => Promise<{
    id: string;
    meetingNumber: string;
    title: string | null;
    status: 'WAITING' | 'IN_PROGRESS' | 'ENDED';
    creatorId: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
    createdAt: string;
    durationSeconds: number;
    participants: Array<{
      userId: string;
      nickname: string;
      isCreator: boolean;
      joinedAt: string;
    }>;
  }>;

  // 结束会议
  endMeeting: (meetingId: string) => Promise<{
    meetingId: string;
    endedAt: string;
    durationSeconds: number;
  }>;

  // 会议号格式化
  formatMeetingNumber: (meetingNumber: string) => string;
  parseMeetingNumber: (input: string) => string;
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

  // REQ-004 音视频控制功能
  // 音频控制
  toggleAudio: (muted: boolean) => ipcRenderer.invoke('toggle-audio', muted),
  setAudioMuted: (muted: boolean) => ipcRenderer.invoke('set-audio-muted', muted),

  // 视频控制
  toggleVideo: (enabled: boolean) => ipcRenderer.invoke('toggle-video', enabled),
  setVideoEnabled: (enabled: boolean) => ipcRenderer.invoke('set-video-enabled', enabled),

  // 设备切换
  switchAudioDevice: (deviceId: string) => ipcRenderer.invoke('switch-audio-device', deviceId),
  switchVideoDevice: (deviceId: string) => ipcRenderer.invoke('switch-video-device', deviceId),

  // 状态同步
  syncMediaState: () => ipcRenderer.invoke('sync-media-state'),

  // REQ-002 会议管理功能
  // 会议创建
  createMeeting: (data?: { title?: string }) => ipcRenderer.invoke('create-meeting', data || {}),

  // 加入会议
  joinMeeting: (data: { meetingNumber: string }) => ipcRenderer.invoke('join-meeting', data),

  // 查询会议列表
  getMeetings: (params?: {
    type?: 'created' | 'joined';
    page?: number;
    pageSize?: number;
  }) => ipcRenderer.invoke('get-meetings', params || {}),

  // 查询会议详情
  getMeetingById: (meetingId: string) => ipcRenderer.invoke('get-meeting-by-id', meetingId),

  // 结束会议
  endMeeting: (meetingId: string) => ipcRenderer.invoke('end-meeting', meetingId),

  // 会议号格式化
  formatMeetingNumber: (meetingNumber: string) => {
    const digits = meetingNumber.replace(/\D/g, '');
    if (digits.length !== 9) return meetingNumber;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  },

  parseMeetingNumber: (input: string) => {
    return input.replace(/\D/g, '');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明扩展（供 TypeScript 使用）
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

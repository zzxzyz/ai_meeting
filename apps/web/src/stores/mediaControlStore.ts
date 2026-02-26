import { create } from 'zustand';
import { SignalingService } from '../services/signaling.service';

interface PeerControlState {
  peerId: string;
  userId: string;
  nickname: string;
  audioMuted: boolean;
  videoDisabled: boolean;
  producers: ProducerInfo[];
  networkQuality: 'good' | 'medium' | 'poor';
}

interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  appData?: any;
}

interface MediaControlState {
  // 信令服务
  signalingService: SignalingService | null;

  // 本地状态
  localAudioMuted: boolean;
  localVideoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  availableDevices: {
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
  };

  // 远端用户状态
  peers: Map<string, PeerControlState>;

  // 加载状态
  loading: {
    audio: boolean;
    video: boolean;
    deviceSwitch: boolean;
  };

  // 错误状态
  error: string | null;

  // Actions
  setSignalingService: (service: SignalingService) => void;

  // 音频控制
  toggleAudio: () => Promise<void>;
  setAudioMuted: (muted: boolean) => void;

  // 视频控制
  toggleVideo: () => Promise<void>;
  setVideoEnabled: (enabled: boolean) => void;

  // 设备管理
  switchAudioDevice: (deviceId: string) => Promise<void>;
  switchVideoDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;

  // 远端状态管理
  updatePeerState: (peerId: string, state: Partial<PeerControlState>) => void;
  removePeer: (peerId: string) => void;

  // 错误处理
  clearError: () => void;
}

export const useMediaControlStore = create<MediaControlState>((set, get) => ({
  // 初始状态
  signalingService: null,
  localAudioMuted: false,
  localVideoEnabled: true,
  audioDeviceId: '',
  videoDeviceId: '',
  availableDevices: {
    audio: [],
    video: []
  },
  peers: new Map(),
  loading: {
    audio: false,
    video: false,
    deviceSwitch: false
  },
  error: null,

  // 设置信令服务
  setSignalingService: (service) => {
    set({ signalingService: service });
  },

  // 切换音频状态
  toggleAudio: async () => {
    const state = get();
    const { signalingService, localAudioMuted } = state;

    if (!signalingService) {
      set({ error: '信令服务未初始化' });
      return;
    }

    set({ loading: { ...state.loading, audio: true }, error: null });

    try {
      const newMutedState = !localAudioMuted;

      // 这里需要根据实际 Producer ID 发送控制指令
      // 暂时模拟实现，实际需要从 MediaService 获取 Producer ID
      if (newMutedState) {
        // 发送静音指令
        await signalingService.pauseProducer('meeting-id', 'audio-producer-id', 'audio');
      } else {
        // 发送取消静音指令
        await signalingService.resumeProducer('meeting-id', 'audio-producer-id', 'audio');
      }

      set({
        localAudioMuted: newMutedState,
        loading: { ...state.loading, audio: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '音频控制失败',
        loading: { ...state.loading, audio: false }
      });
      throw error;
    }
  },

  // 设置音频静音状态
  setAudioMuted: (muted) => {
    set({ localAudioMuted: muted });
  },

  // 切换视频状态
  toggleVideo: async () => {
    const state = get();
    const { signalingService, localVideoEnabled } = state;

    if (!signalingService) {
      set({ error: '信令服务未初始化' });
      return;
    }

    set({ loading: { ...state.loading, video: true }, error: null });

    try {
      const newVideoState = !localVideoEnabled;

      // 这里需要根据实际 Producer ID 发送控制指令
      if (newVideoState) {
        // 发送开启摄像头指令
        await signalingService.resumeProducer('meeting-id', 'video-producer-id', 'video');
      } else {
        // 发送关闭摄像头指令
        await signalingService.pauseProducer('meeting-id', 'video-producer-id', 'video');
      }

      set({
        localVideoEnabled: newVideoState,
        loading: { ...state.loading, video: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '视频控制失败',
        loading: { ...state.loading, video: false }
      });
      throw error;
    }
  },

  // 设置视频启用状态
  setVideoEnabled: (enabled) => {
    set({ localVideoEnabled: enabled });
  },

  // 切换音频设备
  switchAudioDevice: async (deviceId) => {
    const state = get();
    const { signalingService } = state;

    if (!signalingService) {
      set({ error: '信令服务未初始化' });
      return;
    }

    set({ loading: { ...state.loading, deviceSwitch: true }, error: null });

    try {
      // 发送设备切换指令
      await signalingService.switchDevice(
        'meeting-id',
        'audio',
        state.audioDeviceId,
        deviceId
      );

      set({
        audioDeviceId: deviceId,
        loading: { ...state.loading, deviceSwitch: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '音频设备切换失败',
        loading: { ...state.loading, deviceSwitch: false }
      });
      throw error;
    }
  },

  // 切换视频设备
  switchVideoDevice: async (deviceId) => {
    const state = get();
    const { signalingService } = state;

    if (!signalingService) {
      set({ error: '信令服务未初始化' });
      return;
    }

    set({ loading: { ...state.loading, deviceSwitch: true }, error: null });

    try {
      // 发送设备切换指令
      await signalingService.switchDevice(
        'meeting-id',
        'video',
        state.videoDeviceId,
        deviceId
      );

      set({
        videoDeviceId: deviceId,
        loading: { ...state.loading, deviceSwitch: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '视频设备切换失败',
        loading: { ...state.loading, deviceSwitch: false }
      });
      throw error;
    }
  },

  // 刷新设备列表
  refreshDevices: async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      set({
        availableDevices: {
          audio: audioDevices,
          video: videoDevices
        }
      });
    } catch (error: any) {
      set({ error: error.message || '设备列表刷新失败' });
      throw error;
    }
  },

  // 更新远端用户状态
  updatePeerState: (peerId, stateUpdate) => {
    set((state) => {
      const newPeers = new Map(state.peers);
      const existingPeer = newPeers.get(peerId) || {
        peerId,
        userId: '',
        nickname: '',
        audioMuted: false,
        videoDisabled: false,
        producers: [],
        networkQuality: 'good'
      };

      newPeers.set(peerId, { ...existingPeer, ...stateUpdate });
      return { peers: newPeers };
    });
  },

  // 移除用户
  removePeer: (peerId) => {
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.delete(peerId);
      return { peers: newPeers };
    });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  }
}));
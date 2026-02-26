/**
 * Electron 音视频集成工具函数
 * 提供媒体设备枚举、权限请求等 Electron 特有功能
 */

/**
 * 获取媒体设备列表
 * 优先使用 Electron IPC 通道，降级到 navigator.mediaDevices
 */
export const getMediaDevices = async (): Promise<{
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}> => {
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  if (electronAPI?.getMediaDevices) {
    return await electronAPI.getMediaDevices();
  }

  // 降级到 Web API
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
      audioInputs: devices.filter(device => device.kind === 'audioinput'),
      videoInputs: devices.filter(device => device.kind === 'videoinput'),
      audioOutputs: devices.filter(device => device.kind === 'audiooutput')
    };
  }

  // 最终降级：返回空列表
  return {
    audioInputs: [],
    videoInputs: [],
    audioOutputs: []
  };
};

/**
 * 请求媒体权限
 * 优先使用 Electron IPC 通道，降级到 navigator.mediaDevices.getUserMedia
 */
export const requestMediaPermission = async (permissionType: 'camera' | 'microphone' | 'screen'): Promise<{ granted: boolean }> => {
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  if (electronAPI?.requestMediaPermission) {
    return await electronAPI.requestMediaPermission(permissionType);
  }

  // 降级到 Web API
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      let constraints: MediaStreamConstraints;

      switch (permissionType) {
        case 'camera':
          constraints = { video: true, audio: false };
          break;
        case 'microphone':
          constraints = { video: false, audio: true };
          break;
        case 'screen':
          constraints = { video: { mediaSource: 'screen' } };
          break;
        default:
          constraints = { video: true, audio: true };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 清理媒体流
      stream.getTracks().forEach(track => track.stop());

      return { granted: true };
    } catch (error) {
      return { granted: false };
    }
  }

  // 最终降级：假设权限被拒绝
  return { granted: false };
};

/**
 * 检查 WebRTC 支持情况
 */
export const checkWebRTCSupport = (): {
  supported: boolean;
  getUserMedia: boolean;
  enumerateDevices: boolean;
  RTCPeerConnection: boolean;
} => {
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasEnumerateDevices = !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
  const hasRTCPeerConnection = !!(window.RTCPeerConnection || window.webkitRTCPeerConnection);

  return {
    supported: hasGetUserMedia && hasEnumerateDevices && hasRTCPeerConnection,
    getUserMedia: hasGetUserMedia,
    enumerateDevices: hasEnumerateDevices,
    RTCPeerConnection: hasRTCPeerConnection
  };
};

/**
 * 获取默认媒体约束
 */
export const getDefaultMediaConstraints = (): MediaStreamConstraints => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 2,
    sampleRate: 48000,
    sampleSize: 16
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    aspectRatio: { ideal: 16 / 9 }
  }
});

/**
 * 获取屏幕共享约束
 */
export const getScreenShareConstraints = (): MediaStreamConstraints => ({
  video: {
    mediaSource: 'screen',
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 30 }
  },
  audio: false
});
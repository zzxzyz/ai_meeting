import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { MediaService } from '../../services/media.service';
import { SignalingService } from '../../services/signaling.service';
import { VideoGrid } from '../../components/meeting/VideoGrid';
import type { NetworkQuality } from '../../components/meeting/VideoGrid';
import { useToast } from '../../hooks/useToast';

interface PeerInfo {
  peerId: string;
  userId: string;
  nickname: string;
  producers: ProducerInfo[];
}

interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  appData?: any;
}

export const MeetingRoomPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();

  // 服务实例
  const mediaServiceRef = useRef<MediaService | null>(null);
  const signalingServiceRef = useRef<SignalingService | null>(null);

  // 状态管理
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'bad'>('good');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 远端用户音视频控制状态
  const [peerControlStates, setPeerControlStates] = useState<Map<string, { audioMuted: boolean; videoDisabled: boolean }>>(new Map());

  // 初始化服务
  useEffect(() => {
    if (!socket || !meetingId || !user) return;

    const initializeServices = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 创建信令服务
        signalingServiceRef.current = new SignalingService(socket);

        // 创建媒体服务
        mediaServiceRef.current = new MediaService(socket);

        // 加入会议房间
        const joinResponse = await signalingServiceRef.current.joinMeeting(meetingId);
        setPeers(joinResponse.peers);

        // 初始化媒体设备
        await mediaServiceRef.current.initialize(meetingId);

        // 创建发送 Transport
        await mediaServiceRef.current.createSendTransport(meetingId);

        // 创建接收 Transport
        await mediaServiceRef.current.createRecvTransport(meetingId);

        // 开始本地流
        const stream = await mediaServiceRef.current.startLocalStream();
        setLocalStream(stream);

        // 设置事件监听器
        setupEventListeners();

        setConnectionStatus('connected');
        setIsLoading(false);

        showToast('成功加入会议', 'success');

      } catch (err) {
        console.error('Failed to initialize meeting room:', err);
        setError(err instanceof Error ? err.message : '初始化失败');
        setConnectionStatus('failed');
        setIsLoading(false);
        showToast('加入会议失败', 'error');
      }
    };

    initializeServices();

    return () => {
      cleanupServices();
    };
  }, [socket, meetingId, user, showToast]);

  // 设置事件监听器
  const setupEventListeners = () => {
    if (!signalingServiceRef.current) return;

    // 新参与者加入
    signalingServiceRef.current.on('peerJoined', (data: { peer: PeerInfo }) => {
      setPeers(prev => [...prev, data.peer]);
      showToast(`${data.peer.nickname} 加入会议`, 'info');
    });

    // 参与者离开
    signalingServiceRef.current.on('peerLeft', (data: { peerId: string }) => {
      setPeers(prev => prev.filter(p => p.peerId !== data.peerId));
      if (activeSpeakerId === data.peerId) {
        setActiveSpeakerId(null);
      }
    });

    // 新生产者（远端流）
    signalingServiceRef.current.on('newProducer', async (data: { producerId: string; peerId: string; kind: 'audio' | 'video' }) => {
      if (!mediaServiceRef.current) return;

      try {
        await mediaServiceRef.current.consumeRemoteStream(data.producerId, data.peerId);
      } catch (err) {
        console.error('Failed to consume remote stream:', err);
      }
    });

    // 生产者关闭
    signalingServiceRef.current.on('producerClosed', (data: { producerId: string; peerId: string }) => {
      // 更新UI状态
      setPeers(prev => prev.map(peer => {
        if (peer.peerId === data.peerId) {
          return {
            ...peer,
            producers: peer.producers.filter(p => p.id !== data.producerId)
          };
        }
        return peer;
      }));
    });

    // 会议结束
    signalingServiceRef.current.on('meetingEnded', (_data: { endedBy: string; endedAt: string }) => {
      showToast('会议已结束', 'info');
      setTimeout(() => {
        navigate('/meetings');
      }, 2000);
    });

    // 网络质量变化
    signalingServiceRef.current.on('networkQualityChanged', (data: { quality: NetworkQuality }) => {
      setNetworkQuality(data.quality);

      if (data.quality === 'poor' || data.quality === 'bad') {
        showToast('网络质量较差，视频质量已自动降低', 'warning');
      }
    });

    // 活跃发言者变化
    signalingServiceRef.current.on('activeSpeakerChanged', (data: { peerId: string | null }) => {
      setActiveSpeakerId(data.peerId);
    });

    // 远端用户音频静音状态变化
    signalingServiceRef.current.on('peerMuted', (data: { peerId: string }) => {
      setPeerControlStates(prev => {
        const next = new Map(prev);
        const state = next.get(data.peerId) || { audioMuted: false, videoDisabled: false };
        next.set(data.peerId, { ...state, audioMuted: true });
        return next;
      });
    });

    // 远端用户取消音频静音
    signalingServiceRef.current.on('peerUnmuted', (data: { peerId: string }) => {
      setPeerControlStates(prev => {
        const next = new Map(prev);
        const state = next.get(data.peerId) || { audioMuted: false, videoDisabled: false };
        next.set(data.peerId, { ...state, audioMuted: false });
        return next;
      });
    });

    // 远端用户关闭视频
    signalingServiceRef.current.on('peerVideoDisabled', (data: { peerId: string }) => {
      setPeerControlStates(prev => {
        const next = new Map(prev);
        const state = next.get(data.peerId) || { audioMuted: false, videoDisabled: false };
        next.set(data.peerId, { ...state, videoDisabled: true });
        return next;
      });
    });

    // 远端用户开启视频
    signalingServiceRef.current.on('peerVideoEnabled', (data: { peerId: string }) => {
      setPeerControlStates(prev => {
        const next = new Map(prev);
        const state = next.get(data.peerId) || { audioMuted: false, videoDisabled: false };
        next.set(data.peerId, { ...state, videoDisabled: false });
        return next;
      });
    });

    // 房间状态同步（新用户加入时接收当前房间状态）
    signalingServiceRef.current.on('roomState', (data: { peers: Array<{ peerId: string; audioMuted: boolean; videoDisabled: boolean }> }) => {
      const stateMap = new Map<string, { audioMuted: boolean; videoDisabled: boolean }>();
      data.peers.forEach(p => {
        stateMap.set(p.peerId, { audioMuted: p.audioMuted, videoDisabled: p.videoDisabled });
      });
      setPeerControlStates(stateMap);
    });
  };

  // 清理服务
  const cleanupServices = async () => {
    try {
      if (mediaServiceRef.current) {
        await mediaServiceRef.current.cleanup();
        mediaServiceRef.current = null;
      }

      if (signalingServiceRef.current) {
        signalingServiceRef.current.cleanup();
        signalingServiceRef.current = null;
      }

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  };

  // 处理结束通话
  const handleEndCall = async () => {
    try {
      if (signalingServiceRef.current && meetingId) {
        await signalingServiceRef.current.leaveMeeting(meetingId);
      }
      await cleanupServices();
      navigate('/meetings');
    } catch (err) {
      console.error('Failed to end call:', err);
      showToast('结束通话失败', 'error');
    }
  };

  // 切换音频静音
  const handleToggleAudio = async () => {
    if (!mediaServiceRef.current || !meetingId) return;

    try {
      const audioProducer = mediaServiceRef.current.getAudioProducer();
      if (audioProducer) {
        if (isAudioMuted) {
          await audioProducer.resume();
          // 通知服务端取消静音，由服务端广播给其他参与者
          if (signalingServiceRef.current) {
            await signalingServiceRef.current.resumeProducer(meetingId, audioProducer.id, 'audio');
          }
        } else {
          await audioProducer.pause();
          // 通知服务端静音，由服务端广播给其他参与者
          if (signalingServiceRef.current) {
            await signalingServiceRef.current.pauseProducer(meetingId, audioProducer.id, 'audio');
          }
        }
        setIsAudioMuted(!isAudioMuted);
      }
    } catch (err) {
      console.error('Failed to toggle audio:', err);
      showToast('切换音频失败', 'error');
    }
  };

  // 切换视频开关
  const handleToggleVideo = async () => {
    if (!mediaServiceRef.current || !meetingId) return;

    try {
      const videoProducer = mediaServiceRef.current.getVideoProducer();
      if (videoProducer) {
        if (isVideoOff) {
          await videoProducer.resume();
          // 通知服务端开启视频，由服务端广播给其他参与者
          if (signalingServiceRef.current) {
            await signalingServiceRef.current.resumeProducer(meetingId, videoProducer.id, 'video');
          }
        } else {
          await videoProducer.pause();
          // 通知服务端关闭视频，由服务端广播给其他参与者
          if (signalingServiceRef.current) {
            await signalingServiceRef.current.pauseProducer(meetingId, videoProducer.id, 'video');
          }
        }
        setIsVideoOff(!isVideoOff);
      }
    } catch (err) {
      console.error('Failed to toggle video:', err);
      showToast('切换视频失败', 'error');
    }
  };

  // 固定发言者
  const handlePinSpeaker = (peer: PeerInfo) => {
    // 实现固定发言者逻辑
    showToast(`已固定 ${peer.nickname} 为主讲人`, 'info');
  };

  // 重新连接
  const handleReconnect = async () => {
    setConnectionStatus('connecting');
    setError(null);

    try {
      await cleanupServices();

      // 重新初始化
      if (socket && meetingId && user) {
        const signalingService = new SignalingService(socket);
        const mediaService = new MediaService(socket);

        await signalingService.joinMeeting(meetingId);
        await mediaService.initialize(meetingId);
        await mediaService.createSendTransport(meetingId);
        await mediaService.createRecvTransport(meetingId);
        const stream = await mediaService.startLocalStream();

        mediaServiceRef.current = mediaService;
        signalingServiceRef.current = signalingService;
        setLocalStream(stream);
        setConnectionStatus('connected');

        showToast('重新连接成功', 'success');
      }
    } catch (err) {
      setConnectionStatus('failed');
      setError('重新连接失败');
      showToast('重新连接失败', 'error');
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">正在连接会议...</p>
          <p className="text-gray-400 text-sm mt-2">会议号：{meetingId}</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">✕</div>
          <h2 className="text-white text-xl mb-2">连接失败</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={handleReconnect}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              重新连接
            </button>
            <button
              onClick={() => navigate('/meetings')}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              返回会议列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900">
      <VideoGrid
        peers={peers}
        localStream={localStream ?? undefined}
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        connectionStatus={connectionStatus}
        networkQuality={networkQuality}
        activeSpeakerId={activeSpeakerId}
        peerControlStates={peerControlStates}
        onEndCall={handleEndCall}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onPinSpeaker={handlePinSpeaker}
      />
    </div>
  );
};
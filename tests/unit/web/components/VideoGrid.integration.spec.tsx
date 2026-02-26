import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoGrid } from '../../../../apps/web/src/components/Meeting/VideoGrid';
import { MediaService } from '../../../../apps/web/src/services/media.service';
import { SignalingService } from '../../../../apps/web/src/services/signaling.service';

// Mock services
vi.mock('../../../../apps/web/src/services/media.service');
vi.mock('../../../../apps/web/src/services/signaling.service');

// Mock components
vi.mock('../../../../apps/web/src/components/Meeting/VideoTile', () => ({
  VideoTile: ({ peer, onDoubleClick }) => (
    <div data-testid={`video-tile-${peer.peerId}`} onClick={() => onDoubleClick?.(peer)}>
      {peer.nickname}
    </div>
  )
}));

vi.mock('../../../../apps/web/src/components/Meeting/LocalVideo', () => ({
  LocalVideo: ({ onDoubleClick }) => (
    <div data-testid="local-video" onClick={() => onDoubleClick?.()}>
      本地视频
    </div>
  )
}));

describe('VideoGrid Integration', () => {
  let mockMediaService: any;
  let mockSignalingService: any;

  const mockPeers = [
    {
      peerId: 'peer-1',
      userId: 'user-1',
      nickname: '张三',
      producers: [
        { id: 'audio-1', kind: 'audio' },
        { id: 'video-1', kind: 'video' }
      ]
    },
    {
      peerId: 'peer-2',
      userId: 'user-2',
      nickname: '李四',
      producers: [
        { id: 'audio-2', kind: 'audio' }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockMediaService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createSendTransport: vi.fn().mockResolvedValue({ id: 'send-transport' }),
      createRecvTransport: vi.fn().mockResolvedValue({ id: 'recv-transport' }),
      startLocalStream: vi.fn().mockResolvedValue(new MediaStream()),
      cleanup: vi.fn().mockResolvedValue(undefined),
      getAudioProducer: vi.fn().mockReturnValue({
        pause: vi.fn(),
        resume: vi.fn()
      }),
      getVideoProducer: vi.fn().mockReturnValue({
        pause: vi.fn(),
        resume: vi.fn()
      })
    };

    mockSignalingService = {
      joinMeeting: vi.fn().mockResolvedValue({
        peerId: 'local-peer',
        peers: mockPeers
      }),
      on: vi.fn(),
      off: vi.fn(),
      cleanup: vi.fn()
    };

    (MediaService as any).mockImplementation(() => mockMediaService);
    (SignalingService as any).mockImplementation(() => mockSignalingService);
  });

  describe('Meeting Room Lifecycle', () => {
    it('should initialize services and join meeting successfully', async () => {
      const MeetingRoomWrapper = () => {
        const [isConnected, setIsConnected] = useState(false);
        const [peers, setPeers] = useState([]);
        const [localStream, setLocalStream] = useState(null);

        useEffect(() => {
          const initMeeting = async () => {
            const signalingService = new SignalingService({} as any);
            const mediaService = new MediaService({} as any);

            const joinResponse = await signalingService.joinMeeting('meeting-123');
            setPeers(joinResponse.peers);

            await mediaService.initialize('meeting-123');
            await mediaService.createSendTransport('meeting-123');
            await mediaService.createRecvTransport('meeting-123');
            const stream = await mediaService.startLocalStream();
            setLocalStream(stream);

            setIsConnected(true);
          };

          initMeeting();
        }, []);

        if (!isConnected) {
          return <div data-testid="loading">加载中...</div>;
        }

        return (
          <VideoGrid
            peers={peers}
            localStream={localStream}
            isAudioMuted={false}
            isVideoOff={false}
            connectionStatus="connected"
            networkQuality="good"
            activeSpeakerId={null}
            onEndCall={vi.fn()}
            onToggleAudio={vi.fn()}
            onToggleVideo={vi.fn()}
            onPinSpeaker={vi.fn()}
          />
        );
      };

      render(<MeetingRoomWrapper />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(mockSignalingService.joinMeeting).toHaveBeenCalledWith('meeting-123');
      expect(mockMediaService.initialize).toHaveBeenCalledWith('meeting-123');
      expect(mockMediaService.createSendTransport).toHaveBeenCalledWith('meeting-123');
      expect(mockMediaService.createRecvTransport).toHaveBeenCalledWith('meeting-123');
      expect(mockMediaService.startLocalStream).toHaveBeenCalled();

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-2')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();
    });

    it('should handle peer join events', async () => {
      const MeetingRoomWrapper = () => {
        const [peers, setPeers] = useState(mockPeers);

        useEffect(() => {
          const signalingService = new SignalingService({} as any);

          // 模拟新参与者加入事件
          signalingService.on('peerJoined', (data) => {
            setPeers(prev => [...prev, data.peer]);
          });
        }, []);

        return (
          <VideoGrid
            peers={peers}
            localStream={new MediaStream()}
            isAudioMuted={false}
            isVideoOff={false}
            connectionStatus="connected"
            networkQuality="good"
            activeSpeakerId={null}
            onEndCall={vi.fn()}
            onToggleAudio={vi.fn()}
            onToggleVideo={vi.fn()}
            onPinSpeaker={vi.fn()}
          />
        );
      };

      render(<MeetingRoomWrapper />);

      // 初始有2个参与者
      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-2')).toBeInTheDocument();

      // 模拟新参与者加入
      const newPeer = {
        peerId: 'peer-3',
        userId: 'user-3',
        nickname: '王五',
        producers: []
      };

      // 触发事件处理器
      const peerJoinedHandler = mockSignalingService.on.mock.calls.find(
        call => call[0] === 'peerJoined'
      )?.[1];

      if (peerJoinedHandler) {
        peerJoinedHandler({ peer: newPeer });
      }

      await waitFor(() => {
        expect(screen.getByTestId('video-tile-peer-3')).toBeInTheDocument();
      });
    });
  });

  describe('Media Control Integration', () => {
    it('should toggle audio mute state', async () => {
      const onToggleAudio = vi.fn();

      render(
        <VideoGrid
          peers={mockPeers}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={vi.fn()}
          onToggleAudio={onToggleAudio}
          onToggleVideo={vi.fn()}
          onPinSpeaker={vi.fn()}
        />
      );

      const audioButton = screen.getByTestId('toggle-audio-button');
      fireEvent.click(audioButton);

      expect(onToggleAudio).toHaveBeenCalled();
    });

    it('should toggle video state', async () => {
      const onToggleVideo = vi.fn();

      render(
        <VideoGrid
          peers={mockPeers}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={vi.fn()}
          onToggleAudio={vi.fn()}
          onToggleVideo={onToggleVideo}
          onPinSpeaker={vi.fn()}
        />
      );

      const videoButton = screen.getByTestId('toggle-video-button');
      fireEvent.click(videoButton);

      expect(onToggleVideo).toHaveBeenCalled();
    });

    it('should handle end call', async () => {
      const onEndCall = vi.fn();

      render(
        <VideoGrid
          peers={mockPeers}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={onEndCall}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onPinSpeaker={vi.fn()}
        />
      );

      const endCallButton = screen.getByTestId('end-call-button');
      fireEvent.click(endCallButton);

      expect(onEndCall).toHaveBeenCalled();
    });
  });

  describe('Layout Adaptation', () => {
    it('should adapt layout for different participant counts', async () => {
      const { rerender } = render(
        <VideoGrid
          peers={[]}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={vi.fn()}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onPinSpeaker={vi.fn()}
        />
      );

      // 单人布局
      expect(screen.getByText('等待他人加入...')).toBeInTheDocument();

      // 2人布局
      rerender(
        <VideoGrid
          peers={[mockPeers[0]]}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={vi.fn()}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onPinSpeaker={vi.fn()}
        />
      );

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();

      // 4人布局
      const fourPeers = [...mockPeers, {
        peerId: 'peer-3',
        userId: 'user-3',
        nickname: '王五',
        producers: []
      }, {
        peerId: 'peer-4',
        userId: 'user-4',
        nickname: '赵六',
        producers: []
      }];

      rerender(
        <VideoGrid
          peers={fourPeers}
          localStream={new MediaStream()}
          isAudioMuted={false}
          isVideoOff={false}
          connectionStatus="connected"
          networkQuality="good"
          activeSpeakerId={null}
          onEndCall={vi.fn()}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onPinSpeaker={vi.fn()}
        />
      );

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-2')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-3')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-4')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failure gracefully', async () => {
      mockSignalingService.joinMeeting.mockRejectedValue(new Error('Connection failed'));

      const MeetingRoomWrapper = () => {
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
          const initMeeting = async () => {
            try {
              const signalingService = new SignalingService({} as any);
              await signalingService.joinMeeting('meeting-123');
            } catch (err) {
              setError(err.message);
            }
          };

          initMeeting();
        }, []);

        if (error) {
          return <div data-testid="error">{error}</div>;
        }

        return <div data-testid="loading">加载中...</div>;
      };

      render(<MeetingRoomWrapper />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed');
      });
    });

    it('should handle media permission denied', async () => {
      mockMediaService.startLocalStream.mockRejectedValue(
        new Error('Permission denied')
      );

      const MeetingRoomWrapper = () => {
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
          const initMeeting = async () => {
            try {
              const mediaService = new MediaService({} as any);
              await mediaService.startLocalStream();
            } catch (err) {
              setError(err.message);
            }
          };

          initMeeting();
        }, []);

        if (error) {
          return <div data-testid="error">{error}</div>;
        }

        return <div data-testid="loading">加载中...</div>;
      };

      render(<MeetingRoomWrapper />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Permission denied');
      });
    });
  });
});
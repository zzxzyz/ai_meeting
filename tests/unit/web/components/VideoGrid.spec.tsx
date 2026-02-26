import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoGrid } from '../../../../apps/web/src/components/Meeting/VideoGrid';

// Mock 组件
vi.mock('../../../../apps/web/src/components/Meeting/VideoTile', () => ({
  VideoTile: ({ peer, isActiveSpeaker, onDoubleClick }) => (
    <div data-testid={`video-tile-${peer.peerId}`} onClick={() => onDoubleClick?.(peer)}>
      {peer.nickname}
      {isActiveSpeaker && <span data-testid="active-speaker">🎤</span>}
    </div>
  )
}));

vi.mock('../../../../apps/web/src/components/Meeting/LocalVideo', () => ({
  LocalVideo: ({ stream, isMuted, isCameraOff }) => (
    <div data-testid="local-video">
      {stream && 'Local Video'}
      {isMuted && <span data-testid="muted">🔇</span>}
      {isCameraOff && <span data-testid="camera-off">📷✕</span>}
    </div>
  )
}));

vi.mock('../../../../apps/web/src/components/Meeting/ConnectionStatus', () => ({
  ConnectionStatus: ({ status, message }) => (
    <div data-testid="connection-status">
      {status}: {message}
    </div>
  )
}));

vi.mock('../../../../apps/web/src/components/Meeting/NetworkQuality', () => ({
  NetworkQuality: ({ quality }) => (
    <div data-testid="network-quality">Quality: {quality}</div>
  )
}));

vi.mock('../../../../apps/web/src/components/Meeting/ControlBar', () => ({
  ControlBar: ({ onEndCall, onToggleAudio, onToggleVideo }) => (
    <div data-testid="control-bar">
      <button onClick={onEndCall} data-testid="end-call-button">结束通话</button>
      <button onClick={onToggleAudio} data-testid="toggle-audio-button">静音</button>
      <button onClick={onToggleVideo} data-testid="toggle-video-button">摄像头</button>
    </div>
  )
}));

describe('VideoGrid', () => {
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
    },
    {
      peerId: 'peer-3',
      userId: 'user-3',
      nickname: '王五',
      producers: [
        { id: 'audio-3', kind: 'audio' },
        { id: 'video-3', kind: 'video' }
      ]
    }
  ];

  const defaultProps = {
    peers: mockPeers,
    localStream: new MediaStream(),
    isAudioMuted: false,
    isVideoOff: false,
    connectionStatus: 'connected' as const,
    networkQuality: 'good' as const,
    activeSpeakerId: null,
    onEndCall: vi.fn(),
    onToggleAudio: vi.fn(),
    onToggleVideo: vi.fn(),
    onPinSpeaker: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('布局渲染', () => {
    it('应该渲染单人布局（等待他人加入）', () => {
      render(<VideoGrid {...defaultProps} peers={[]} />);

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();
      expect(screen.getByText('等待他人加入...')).toBeInTheDocument();
    });

    it('应该渲染2人布局（左右各半）', () => {
      const twoPeers = mockPeers.slice(0, 1); // 只有1个远端 + 本地 = 2人
      render(<VideoGrid {...defaultProps} peers={twoPeers} />);

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();

      // 检查是否使用2人布局的CSS类
      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('应该渲染3人布局（1大+2小）', () => {
      const threePeers = mockPeers.slice(0, 2); // 2个远端 + 本地 = 3人
      render(<VideoGrid {...defaultProps} peers={threePeers} />);

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-2')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();

      // 检查是否使用3人布局的CSS类
      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid-cols-3');
    });

    it('应该渲染4人布局（2×2网格）', () => {
      const fourPeers = mockPeers; // 3个远端 + 本地 = 4人
      render(<VideoGrid {...defaultProps} peers={fourPeers} />);

      expect(screen.getByTestId('video-tile-peer-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-2')).toBeInTheDocument();
      expect(screen.getByTestId('video-tile-peer-3')).toBeInTheDocument();
      expect(screen.getByTestId('local-video')).toBeInTheDocument();

      // 检查是否使用4人布局的CSS类
      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('应该渲染更多人的布局（网格）', () => {
      const manyPeers = [
        ...mockPeers,
        {
          peerId: 'peer-4',
          userId: 'user-4',
          nickname: '赵六',
          producers: [{ id: 'audio-4', kind: 'audio' }]
        }
      ];
      render(<VideoGrid {...defaultProps} peers={manyPeers} />);

      // 检查是否使用网格布局
      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid');
    });
  });

  describe('活跃发言者', () => {
    it('应该高亮活跃发言者', () => {
      render(<VideoGrid {...defaultProps} activeSpeakerId="peer-1" />);

      const activeSpeaker = screen.getByTestId('video-tile-peer-1');
      expect(activeSpeaker.querySelector('[data-testid="active-speaker"]')).toBeInTheDocument();
    });

    it('应该允许固定发言者', () => {
      const onPinSpeaker = vi.fn();
      render(<VideoGrid {...defaultProps} onPinSpeaker={onPinSpeaker} />);

      const videoTile = screen.getByTestId('video-tile-peer-1');
      fireEvent.click(videoTile);

      expect(onPinSpeaker).toHaveBeenCalledWith(mockPeers[0]);
    });
  });

  describe('本地视频状态', () => {
    it('应该显示静音状态', () => {
      render(<VideoGrid {...defaultProps} isAudioMuted={true} />);

      expect(screen.getByTestId('muted')).toBeInTheDocument();
    });

    it('应该显示摄像头关闭状态', () => {
      render(<VideoGrid {...defaultProps} isVideoOff={true} />);

      expect(screen.getByTestId('camera-off')).toBeInTheDocument();
    });
  });

  describe('连接状态', () => {
    it('应该显示连接中状态', () => {
      render(<VideoGrid {...defaultProps} connectionStatus="connecting" />);

      const status = screen.getByTestId('connection-status');
      expect(status.textContent).toContain('connecting');
    });

    it('应该显示连接失败状态', () => {
      render(<VideoGrid {...defaultProps} connectionStatus="failed" />);

      const status = screen.getByTestId('connection-status');
      expect(status.textContent).toContain('failed');
    });
  });

  describe('网络质量', () => {
    it('应该显示网络质量指示器', () => {
      render(<VideoGrid {...defaultProps} networkQuality="poor" />);

      const quality = screen.getByTestId('network-quality');
      expect(quality.textContent).toContain('poor');
    });
  });

  describe('控制栏', () => {
    it('应该渲染控制栏并处理事件', () => {
      const onEndCall = vi.fn();
      const onToggleAudio = vi.fn();
      const onToggleVideo = vi.fn();

      render(
        <VideoGrid
          {...defaultProps}
          onEndCall={onEndCall}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
        />
      );

      fireEvent.click(screen.getByTestId('end-call-button'));
      fireEvent.click(screen.getByTestId('toggle-audio-button'));
      fireEvent.click(screen.getByTestId('toggle-video-button'));

      expect(onEndCall).toHaveBeenCalled();
      expect(onToggleAudio).toHaveBeenCalled();
      expect(onToggleVideo).toHaveBeenCalled();
    });
  });

  describe('响应式布局', () => {
    it('应该在小屏幕上使用单列布局', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600
      });

      render(<VideoGrid {...defaultProps} peers={mockPeers} />);

      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid-cols-1');
    });

    it('应该在大屏幕上使用多列布局', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      });

      render(<VideoGrid {...defaultProps} peers={mockPeers} />);

      const grid = screen.getByTestId('video-grid');
      expect(grid).toHaveClass('grid-cols-2');
    });
  });

  describe('空状态', () => {
    it('应该处理没有本地流的情况', () => {
      render(<VideoGrid {...defaultProps} localStream={undefined} />);

      const localVideo = screen.getByTestId('local-video');
      expect(localVideo.textContent).not.toContain('Local Video');
    });

    it('应该处理没有参与者的状态', () => {
      render(<VideoGrid {...defaultProps} peers={[]} />);

      expect(screen.getByText('等待他人加入...')).toBeInTheDocument();
      expect(screen.getByText('分享会议号邀请对方')).toBeInTheDocument();
    });
  });
});
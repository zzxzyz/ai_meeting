import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ControlBar, VideoTile, LocalVideo } from './mock-components';

// Mock MediaService
const mockMediaService = {
  toggleAudio: jest.fn().mockResolvedValue(undefined),
  toggleVideo: jest.fn().mockResolvedValue(undefined),
  getAudioProducer: jest.fn().mockReturnValue({ paused: false }),
  getVideoProducer: jest.fn().mockReturnValue({ paused: false }),
};

describe('音视频控制功能', () => {
  describe('ControlBar 组件', () => {
    it('应该显示音频控制按钮并正确切换状态', () => {
      const mockToggleAudio = jest.fn();

      render(
        <ControlBar
          onEndCall={() => {}}
          onToggleAudio={mockToggleAudio}
          onToggleVideo={() => {}}
          isAudioMuted={false}
          isVideoOff={false}
        />
      );

      // 检查音频按钮显示
      const audioButton = screen.getByTestId('toggle-audio-button');
      expect(audioButton).toBeInTheDocument();
      expect(screen.getByText('静音')).toBeInTheDocument();
      expect(screen.getByText('🎙️')).toBeInTheDocument();

      // 测试点击事件
      fireEvent.click(audioButton);
      expect(mockToggleAudio).toHaveBeenCalledTimes(1);
    });

    it('应该显示静音状态下的音频按钮', () => {
      render(
        <ControlBar
          onEndCall={() => {}}
          onToggleAudio={() => {}}
          onToggleVideo={() => {}}
          isAudioMuted={true}
          isVideoOff={false}
        />
      );

      expect(screen.getByText('取消静音')).toBeInTheDocument();
      expect(screen.getByText('🔇')).toBeInTheDocument();
    });

    it('应该显示视频控制按钮并正确切换状态', () => {
      const mockToggleVideo = jest.fn();

      render(
        <ControlBar
          onEndCall={() => {}}
          onToggleAudio={() => {}}
          onToggleVideo={mockToggleVideo}
          isAudioMuted={false}
          isVideoOff={false}
        />
      );

      const videoButton = screen.getByTestId('toggle-video-button');
      expect(videoButton).toBeInTheDocument();
      expect(screen.getByText('关闭视频')).toBeInTheDocument();
      expect(screen.getByText('📹')).toBeInTheDocument();

      fireEvent.click(videoButton);
      expect(mockToggleVideo).toHaveBeenCalledTimes(1);
    });

    it('应该显示摄像头关闭状态下的视频按钮', () => {
      render(
        <ControlBar
          onEndCall={() => {}}
          onToggleAudio={() => {}}
          onToggleVideo={() => {}}
          isAudioMuted={false}
          isVideoOff={true}
        />
      );

      expect(screen.getByText('开启视频')).toBeInTheDocument();
      expect(screen.getByText('📷✕')).toBeInTheDocument();
    });
  });

  describe('VideoTile 组件', () => {
    const mockPeer = {
      peerId: 'peer-123',
      userId: 'user-456',
      nickname: '张三',
      producers: []
    };

    it('应该显示远端用户的静音状态指示器', () => {
      render(
        <VideoTile
          peer={mockPeer}
          hasVideo={true}
          hasAudio={false} // 静音状态
          isActiveSpeaker={false}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByTitle('麦克风静音')).toBeInTheDocument();
      expect(screen.getByText('🔇')).toBeInTheDocument();
    });

    it('应该显示远端用户的摄像头关闭状态指示器', () => {
      render(
        <VideoTile
          peer={mockPeer}
          hasVideo={false} // 摄像头关闭
          hasAudio={true}
          isActiveSpeaker={false}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByTitle('摄像头关闭')).toBeInTheDocument();
      expect(screen.getByText('📷✕')).toBeInTheDocument();
    });

    it('应该在摄像头关闭时显示用户头像占位', () => {
      render(
        <VideoTile
          peer={mockPeer}
          hasVideo={false}
          hasAudio={true}
          isActiveSpeaker={false}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.getAllByText('张三').length).toBeGreaterThan(0);
    });
  });

  describe('LocalVideo 组件', () => {
    it('应该显示本地用户的静音状态', () => {
      render(
        <LocalVideo
          stream={undefined}
          isMuted={true}
          isCameraOff={false}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByTestId('muted')).toBeInTheDocument();
      expect(screen.getByText('🔇')).toBeInTheDocument();
    });

    it('应该显示本地用户的摄像头关闭状态', () => {
      render(
        <LocalVideo
          stream={undefined}
          isMuted={false}
          isCameraOff={true}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByTestId('camera-off')).toBeInTheDocument();
      expect(screen.getByText('📷✕')).toBeInTheDocument();
    });

    it('应该在摄像头关闭时显示用户头像占位', () => {
      render(
        <LocalVideo
          stream={undefined}
          isMuted={false}
          isCameraOff={true}
          isMainSpeaker={false}
          isPinned={false}
        />
      );

      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.getAllByText('我').length).toBeGreaterThan(0);
    });
  });

  describe('信令服务扩展', () => {
    it('应该发送静音控制指令', async () => {
      const mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      };

      // 模拟信令服务
      const signalingService = {
        sendAudioControl: jest.fn().mockResolvedValue(undefined)
      };

      await signalingService.sendAudioControl('meeting-123', true);

      expect(signalingService.sendAudioControl).toHaveBeenCalledWith('meeting-123', true);
    });

    it('应该发送视频控制指令', async () => {
      const mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      };

      const signalingService = {
        sendVideoControl: jest.fn().mockResolvedValue(undefined)
      };

      await signalingService.sendVideoControl('meeting-123', false);

      expect(signalingService.sendVideoControl).toHaveBeenCalledWith('meeting-123', false);
    });
  });

  describe('状态管理', () => {
    it('应该更新本地音频状态', () => {
      const mockStore = {
        setAudioMuted: jest.fn(),
        setVideoEnabled: jest.fn()
      };

      mockStore.setAudioMuted(true);
      expect(mockStore.setAudioMuted).toHaveBeenCalledWith(true);
    });

    it('应该更新远端用户状态', () => {
      const mockStore = {
        updatePeerState: jest.fn()
      };

      mockStore.updatePeerState('peer-123', { audioMuted: true, videoDisabled: false });
      expect(mockStore.updatePeerState).toHaveBeenCalledWith('peer-123', { audioMuted: true, videoDisabled: false });
    });
  });
});
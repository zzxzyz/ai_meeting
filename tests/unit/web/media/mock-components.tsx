import React from 'react';

// Mock ControlBar 组件
interface ControlBarProps {
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  isAudioMuted: boolean;
  isVideoOff: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  isAudioMuted,
  isVideoOff
}) => {
  return (
    <div data-testid="control-bar">
      <button
        onClick={onToggleAudio}
        data-testid="toggle-audio-button"
        title={isAudioMuted ? '取消静音' : '静音'}
      >
        <span>{isAudioMuted ? '🔇' : '🎙️'}</span>
        <span>{isAudioMuted ? '取消静音' : '静音'}</span>
      </button>

      <button
        onClick={onToggleVideo}
        data-testid="toggle-video-button"
        title={isVideoOff ? '开启摄像头' : '关闭摄像头'}
      >
        <span>{isVideoOff ? '📷✕' : '📹'}</span>
        <span>{isVideoOff ? '开启视频' : '关闭视频'}</span>
      </button>

      <button onClick={onEndCall} data-testid="end-call-button">
        <span>📞</span>
        <span>结束</span>
      </button>
    </div>
  );
};

// Mock VideoTile 组件
interface VideoTileProps {
  peer: {
    peerId: string;
    nickname: string;
  };
  hasVideo: boolean;
  hasAudio: boolean;
  isActiveSpeaker: boolean;
  isMainSpeaker: boolean;
  isPinned: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  peer,
  hasVideo,
  hasAudio,
  isActiveSpeaker,
  isMainSpeaker,
  isPinned
}) => {
  return (
    <div data-testid={`video-tile-${peer.peerId}`}>
      {hasVideo ? (
        <video autoPlay playsInline muted={!hasAudio} />
      ) : (
        <div>
          <span>👤</span>
          <span>{peer.nickname}</span>
        </div>
      )}

      <div>
        <span>{peer.nickname}</span>
        {isPinned && <span>固定</span>}
      </div>

      <div>
        {!hasAudio && <span title="麦克风静音" data-testid="audio-muted">🔇</span>}
        {!hasVideo && <span title="摄像头关闭" data-testid="video-off">📷✕</span>}
        {isActiveSpeaker && <span title="正在发言">🎤</span>}
      </div>
    </div>
  );
};

// Mock LocalVideo 组件
interface LocalVideoProps {
  stream?: MediaStream;
  isMuted: boolean;
  isCameraOff: boolean;
  isMainSpeaker: boolean;
  isPinned: boolean;
}

export const LocalVideo: React.FC<LocalVideoProps> = ({
  stream,
  isMuted,
  isCameraOff,
  isMainSpeaker,
  isPinned
}) => {
  return (
    <div data-testid="local-video">
      {stream && !isCameraOff ? (
        <video autoPlay playsInline muted={true} />
      ) : (
        <div>
          <span>👤</span>
          <span>我</span>
        </div>
      )}

      <div>
        <span>我</span>
        {isPinned && <span>固定</span>}
      </div>

      <div>
        {isMuted && <span data-testid="muted">🔇</span>}
        {isCameraOff && <span data-testid="camera-off">📷✕</span>}
        <span title="本地视频">📹</span>
      </div>
    </div>
  );
};
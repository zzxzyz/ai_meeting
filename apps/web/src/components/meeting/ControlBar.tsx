import React from 'react';

interface ControlBarProps {
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  showChatButton?: boolean;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  showSettingsButton?: boolean;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  isAudioMuted,
  isVideoOff,
  showChatButton = false,
  onToggleChat,
  isChatOpen = false,
  showSettingsButton = false,
  onToggleSettings,
  isSettingsOpen = false
}) => {
  const getButtonClass = (isActive?: boolean, isDanger?: boolean) => {
    const baseClasses = "flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200";

    if (isDanger) {
      return `${baseClasses} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`;
    }

    if (isActive) {
      return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`;
    }

    return `${baseClasses} bg-white/20 text-white hover:bg-white/30 active:bg-white/40 backdrop-blur-sm`;
  };

  return (
    <div className="flex items-center justify-center space-x-4 p-4">
      {/* 音频控制按钮 */}
      <button
        onClick={onToggleAudio}
        className={getButtonClass(isAudioMuted)}
        data-testid="toggle-audio-button"
        title={isAudioMuted ? '取消静音' : '静音'}
      >
        <span className="text-xl">
          {isAudioMuted ? '🔇' : '🎙️'}
        </span>
        <span className="text-xs mt-1">
          {isAudioMuted ? '取消静音' : '静音'}
        </span>
      </button>

      {/* 视频控制按钮 */}
      <button
        onClick={onToggleVideo}
        className={getButtonClass(isVideoOff)}
        data-testid="toggle-video-button"
        title={isVideoOff ? '开启摄像头' : '关闭摄像头'}
      >
        <span className="text-xl">
          {isVideoOff ? '📷✕' : '📹'}
        </span>
        <span className="text-xs mt-1">
          {isVideoOff ? '开启视频' : '关闭视频'}
        </span>
      </button>

      {/* 聊天按钮（预留功能） */}
      {showChatButton && onToggleChat && (
        <button
          onClick={onToggleChat}
          className={getButtonClass(isChatOpen)}
          title={isChatOpen ? '关闭聊天' : '打开聊天'}
        >
          <span className="text-xl">💬</span>
          <span className="text-xs mt-1">聊天</span>
        </button>
      )}

      {/* 设置按钮（预留功能） */}
      {showSettingsButton && onToggleSettings && (
        <button
          onClick={onToggleSettings}
          className={getButtonClass(isSettingsOpen)}
          title="设置"
        >
          <span className="text-xl">⚙️</span>
          <span className="text-xs mt-1">设置</span>
        </button>
      )}

      {/* 结束通话按钮 */}
      <button
        onClick={onEndCall}
        className={getButtonClass(false, true)}
        data-testid="end-call-button"
        title="结束通话"
      >
        <span className="text-xl">📞</span>
        <span className="text-xs mt-1">结束</span>
      </button>
    </div>
  );
};
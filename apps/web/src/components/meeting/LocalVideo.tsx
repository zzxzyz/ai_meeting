import React, { useRef, useEffect } from 'react';

interface LocalVideoProps {
  stream?: MediaStream;
  audioMuted: boolean;
  videoEnabled: boolean;
  isMainSpeaker: boolean;
  isPinned: boolean;
  onDoubleClick?: () => void;
}

export const LocalVideo: React.FC<LocalVideoProps> = ({
  stream,
  audioMuted,
  videoEnabled,
  isMainSpeaker,
  isPinned,
  onDoubleClick
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick();
    }
  };

  return (
    <div
      className={`
        relative w-full h-full rounded-lg overflow-hidden
        ${isMainSpeaker ? 'border-2 border-blue-500' : 'border border-gray-700'}
        ${isPinned ? 'shadow-lg' : 'shadow-md'}
        transition-all duration-200
      `}
      onDoubleClick={handleDoubleClick}
      data-testid="local-video"
    >
      {/* 视频渲染区域 */}
      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
        {stream && videoEnabled ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">👤</span>
            </div>
            <span className="text-sm">我</span>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm font-medium">我</span>
            {isPinned && (
              <span className="text-xs bg-blue-500 text-white px-1 rounded">
                固定
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* 音频状态 */}
            {audioMuted && (
              <span className="text-red-400 text-sm" title="麦克风静音" data-testid="muted">🔇</span>
            )}

            {/* 视频状态 */}
            {!videoEnabled && (
              <span className="text-gray-400 text-sm" title="摄像头关闭" data-testid="camera-off">📷✕</span>
            )}

            {/* 本地视频指示器 */}
            <span className="text-blue-400 text-sm" title="本地视频">📹</span>
          </div>
        </div>
      </div>

      {/* 状态指示器 */}
      <div className="absolute top-2 left-2 flex items-center space-x-2">
        {audioMuted && (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            静音
          </span>
        )}
        {!videoEnabled && (
          <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
            摄像头关闭
          </span>
        )}
      </div>

      {/* 网络质量指示器 */}
      <div className="absolute top-2 right-2 flex items-center space-x-1">
        <div className="w-2 h-1 bg-green-400 rounded"></div>
        <div className="w-2 h-1 bg-green-400 rounded"></div>
        <div className="w-2 h-1 bg-green-400 rounded"></div>
      </div>

      {/* 悬停提示 */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200">
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          双击固定为主讲人
        </div>
      </div>

      {/* 加载状态 */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { PeerInfo } from './VideoGrid';

export interface VideoTileProps {
  peer: PeerInfo;
  hasVideo: boolean;
  hasAudio: boolean;
  isActiveSpeaker: boolean;
  isMainSpeaker: boolean;
  isPinned: boolean;
  onDoubleClick?: (peer: PeerInfo) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  peer,
  hasVideo,
  hasAudio,
  isActiveSpeaker,
  isMainSpeaker,
  isPinned,
  onDoubleClick
}) => {
  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(peer);
    }
  };

  return (
    <div
      className={`
        relative w-full h-full rounded-lg overflow-hidden
        ${isMainSpeaker ? 'border-2 border-blue-500' : 'border border-gray-700'}
        ${isActiveSpeaker ? 'ring-2 ring-yellow-400' : ''}
        ${isPinned ? 'shadow-lg' : 'shadow-md'}
        transition-all duration-200
      `}
      onDoubleClick={handleDoubleClick}
      data-testid={`video-tile-${peer.peerId}`}
    >
      {/* 视频渲染区域 */}
      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
        {hasVideo ? (
          <video
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={!hasAudio}
            data-peer-id={peer.peerId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">👤</span>
            </div>
            <span className="text-sm">{peer.nickname}</span>
          </div>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm font-medium truncate">
              {peer.nickname}
            </span>
            {isPinned && (
              <span className="text-xs bg-blue-500 text-white px-1 rounded">
                固定
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* 音频状态 */}
            {!hasAudio && (
              <span className="text-red-400 text-sm" title="麦克风静音">🔇</span>
            )}

            {/* 视频状态 */}
            {!hasVideo && (
              <span className="text-gray-400 text-sm" title="摄像头关闭">📷✕</span>
            )}

            {/* 活跃发言者指示器 */}
            {isActiveSpeaker && (
              <span className="text-yellow-400 text-sm animate-pulse" title="正在发言">🎤</span>
            )}
          </div>
        </div>
      </div>

      {/* 网络质量指示器 */}
      <div className="absolute top-2 right-2 flex items-center space-x-1">
        <div className="w-2 h-1 bg-green-400 rounded"></div>
        <div className="w-2 h-1 bg-green-400 rounded"></div>
        <div className="w-2 h-1 bg-green-400 rounded"></div>
      </div>

      {/* 加载状态 */}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}

      {/* 悬停提示 */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200">
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          双击固定为主讲人
        </div>
      </div>
    </div>
  );
};
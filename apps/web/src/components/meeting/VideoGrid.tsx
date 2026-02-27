import React, { useState, useEffect, useMemo } from 'react';
import { VideoTile } from './VideoTile';
import { LocalVideo } from './LocalVideo';
import { ConnectionStatus } from './ConnectionStatus';
import { NetworkQuality } from './NetworkQuality';
import { ControlBar } from './ControlBar';

export interface PeerInfo {
  peerId: string;
  userId: string;
  nickname: string;
  producers: ProducerInfo[];
}

export interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  appData?: any;
}

export type ConnectionStatusState = 'connecting' | 'connected' | 'disconnected' | 'failed';
export type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface VideoGridProps {
  // 参与者信息
  peers: PeerInfo[];
  localStream?: MediaStream;

  // 本地状态
  isAudioMuted: boolean;
  isVideoOff: boolean;

  // 连接状态
  connectionStatus: ConnectionStatusState;
  networkQuality: NetworkQualityLevel;

  // 活跃发言者
  activeSpeakerId?: string | null;

  // 事件处理
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onPinSpeaker: (peer: PeerInfo) => void;
}

/**
 * 视频网格组件
 * 根据参与人数自动调整布局：
 * - 1人：全屏显示本地视频
 * - 2人：左右各半
 * - 3人：1大+2小（主讲人模式）
 * - 4人：2×2网格
 * - 5+人：自适应网格
 */
export const VideoGrid: React.FC<VideoGridProps> = ({
  peers,
  localStream,
  isAudioMuted,
  isVideoOff,
  connectionStatus,
  networkQuality,
  activeSpeakerId,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onPinSpeaker
}) => {
  const [pinnedSpeakerId, setPinnedSpeakerId] = useState<string | null>(null);
  const [gridLayout, setGridLayout] = useState<'single' | 'two' | 'three' | 'grid'>('single');

  // 计算总参与人数（包括本地）
  const totalParticipants = peers.length + (localStream ? 1 : 0);

  // 根据参与人数自动调整布局
  useEffect(() => {
    if (totalParticipants === 1) {
      setGridLayout('single');
    } else if (totalParticipants === 2) {
      setGridLayout('two');
    } else if (totalParticipants === 3) {
      setGridLayout('three');
    } else {
      setGridLayout('grid');
    }
  }, [totalParticipants]);

  // 获取当前主讲人（固定或活跃发言者）
  const mainSpeaker = useMemo(() => {
    if (pinnedSpeakerId) {
      return peers.find(peer => peer.peerId === pinnedSpeakerId);
    }
    if (activeSpeakerId) {
      return peers.find(peer => peer.peerId === activeSpeakerId);
    }
    return null;
  }, [pinnedSpeakerId, activeSpeakerId, peers]);

  // 处理固定发言者
  const handlePinSpeaker = (peer: PeerInfo) => {
    if (pinnedSpeakerId === peer.peerId) {
      setPinnedSpeakerId(null);
    } else {
      setPinnedSpeakerId(peer.peerId);
    }
    onPinSpeaker(peer);
  };

  // 渲染单个视频格
  const renderVideoTile = (peer: PeerInfo, isMainSpeaker: boolean = false) => {
    const hasVideo = peer.producers.some(p => p.kind === 'video');
    const hasAudio = peer.producers.some(p => p.kind === 'audio');
    const isActiveSpeaker = activeSpeakerId === peer.peerId;

    return (
      <VideoTile
        key={peer.peerId}
        peer={peer}
        hasVideo={hasVideo}
        hasAudio={hasAudio}
        isActiveSpeaker={isActiveSpeaker}
        isMainSpeaker={isMainSpeaker}
        isPinned={pinnedSpeakerId === peer.peerId}
        onDoubleClick={() => handlePinSpeaker(peer)}
      />
    );
  };

  // 渲染本地视频
  const renderLocalVideo = (isMainSpeaker: boolean = false) => {
    if (!localStream) return null;

    return (
      <LocalVideo
        key="local"
        stream={localStream}
        isMuted={isAudioMuted}
        isCameraOff={isVideoOff}
        isMainSpeaker={isMainSpeaker}
        isPinned={pinnedSpeakerId === 'local'}
        onDoubleClick={() => {
          if (pinnedSpeakerId === 'local') {
            setPinnedSpeakerId(null);
          } else {
            setPinnedSpeakerId('local');
          }
        }}
      />
    );
  };

  // 1人布局：全屏本地视频
  const renderSingleLayout = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="relative w-full max-w-4xl aspect-video">
          {renderLocalVideo(true)}
        </div>
        <div className="mt-4 text-center">
          <p className="text-gray-600">等待他人加入...</p>
          <p className="text-sm text-gray-400 mt-1">分享会议号邀请对方</p>
        </div>
      </div>
    );
  };

  // 2人布局：左右各半
  const renderTwoLayout = () => {
    const [firstPeer] = peers;

    return (
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="flex items-center justify-center">
          {renderVideoTile(firstPeer)}
        </div>
        <div className="flex items-center justify-center">
          {renderLocalVideo()}
        </div>
      </div>
    );
  };

  // 3人布局：1大+2小
  const renderThreeLayout = () => {
    const [firstPeer, secondPeer] = peers;

    return (
      <div className="grid grid-cols-3 gap-4 h-full">
        <div className="col-span-2 flex items-center justify-center">
          {mainSpeaker ? renderVideoTile(mainSpeaker, true) : renderLocalVideo(true)}
        </div>
        <div className="flex flex-col gap-4">
          {mainSpeaker ? (
            <>
              {renderLocalVideo()}
              {renderVideoTile(mainSpeaker === firstPeer ? secondPeer : firstPeer)}
            </>
          ) : (
            <>
              {renderVideoTile(firstPeer)}
              {renderVideoTile(secondPeer)}
            </>
          )}
        </div>
      </div>
    );
  };

  // 4+人布局：自适应网格
  const renderGridLayout = () => {
    const allParticipants = [...peers, { peerId: 'local', userId: 'local', nickname: '我', producers: [] }];

    // 计算网格列数
    const getGridCols = () => {
      if (totalParticipants <= 4) return 'grid-cols-2';
      if (totalParticipants <= 6) return 'grid-cols-3';
      if (totalParticipants <= 9) return 'grid-cols-4';
      return 'grid-cols-5';
    };

    return (
      <div className={`grid ${getGridCols()} gap-4 h-full overflow-auto`}>
        {allParticipants.map((participant) => {
          if (participant.peerId === 'local') {
            return (
              <div key="local" className="flex items-center justify-center">
                {renderLocalVideo()}
              </div>
            );
          }
          return (
            <div key={participant.peerId} className="flex items-center justify-center">
              {renderVideoTile(participant)}
            </div>
          );
        })}
      </div>
    );
  };

  // 根据布局选择渲染方式
  const renderContent = () => {
    switch (gridLayout) {
      case 'single':
        return renderSingleLayout();
      case 'two':
        return renderTwoLayout();
      case 'three':
        return renderThreeLayout();
      case 'grid':
        return renderGridLayout();
      default:
        return renderSingleLayout();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between p-4 bg-black bg-opacity-50">
        <ConnectionStatus status={connectionStatus} />
        <NetworkQuality quality={networkQuality} />
      </div>

      {/* 视频网格区域 */}
      <div className="flex-1 p-4">
        {renderContent()}
      </div>

      {/* 底部控制栏 */}
      <div className="p-4 bg-black bg-opacity-50">
        <ControlBar
          onEndCall={onEndCall}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
        />
      </div>
    </div>
  );
};
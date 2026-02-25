import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetingStore } from '../../stores/meetingStore';
import { useAuth } from '../../hooks/useAuth';
import { MeetingStatusBadge } from '../../components/Meeting/MeetingStatusBadge';
import { EndMeetingModal } from '../../components/Meeting/EndMeetingModal';
import { MeetingStatus, formatMeetingNumber } from '../../api/meeting';

/**
 * 格式化时长（秒 → X 分钟 / X 小时 X 分钟）
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes > 0 ? `${hours} 小时 ${remainMinutes} 分钟` : `${hours} 小时`;
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 会议详情页面
 */
export const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentMeeting, isLoading, isEnding, error, fetchMeetingById, endMeeting, clearError } =
    useMeetingStore();

  const [showEndModal, setShowEndModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);

  // 加载会议详情
  useEffect(() => {
    if (id) {
      fetchMeetingById(id);
    }
  }, [id, fetchMeetingById]);

  // 实时计算进行中会议的时长
  useEffect(() => {
    if (!currentMeeting || currentMeeting.status !== MeetingStatus.IN_PROGRESS || !currentMeeting.startedAt) {
      return;
    }

    const startTime = new Date(currentMeeting.startedAt).getTime();
    const update = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setLiveDuration(elapsed);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentMeeting]);

  const handleCopyMeetingNumber = async () => {
    if (!currentMeeting) return;
    const formatted = formatMeetingNumber(currentMeeting.meetingNumber);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败
    }
  };

  const handleEndMeeting = async () => {
    if (!currentMeeting) return;
    try {
      await endMeeting(currentMeeting.id);
      setShowEndModal(false);
    } catch {
      setShowEndModal(false);
    }
  };

  const handleRejoin = () => {
    if (currentMeeting) {
      // REQ-003 实现后跳转到会议中页面，当前先加入
      navigate(`/meetings/join?number=${currentMeeting.meetingNumber}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12" data-testid="meeting-detail-loading">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentMeeting && !isLoading) {
    return (
      <div className="px-4 py-6 text-center" data-testid="meeting-not-found">
        <p className="text-gray-500">会议不存在或无权访问</p>
        <button
          onClick={() => navigate('/meetings')}
          className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
        >
          返回会议列表
        </button>
      </div>
    );
  }

  if (!currentMeeting) return null;

  const isCreator = user?.id === currentMeeting.creatorId;
  const isActive = currentMeeting.status === MeetingStatus.IN_PROGRESS;
  const durationSeconds = isActive ? liveDuration : currentMeeting.durationSeconds;
  const formattedNumber = formatMeetingNumber(currentMeeting.meetingNumber);

  return (
    <div className="px-4 py-6 sm:px-0 max-w-3xl mx-auto" data-testid="meeting-detail-page">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate('/meetings')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← 返回列表
      </button>

      {/* 标题和状态 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          {currentMeeting.title || '未命名会议'}
        </h2>
        <MeetingStatusBadge status={currentMeeting.status} />
      </div>

      {/* 会议基本信息 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">会议号</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-gray-900" data-testid="meeting-number-display">
                {formattedNumber}
              </span>
              <button
                onClick={handleCopyMeetingNumber}
                className="text-xs text-blue-600 hover:text-blue-700"
                data-testid="copy-button"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          {currentMeeting.startedAt && (
            <div>
              <p className="text-xs text-gray-400 mb-1">开始时间</p>
              <p className="text-sm text-gray-700">{formatDateTime(currentMeeting.startedAt)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">持续时长</p>
            <p className="text-sm text-gray-700" data-testid="duration-display">
              {durationSeconds > 0 ? formatDuration(durationSeconds) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">参与人数</p>
            <p className="text-sm text-gray-700">{currentMeeting.participantCount} 人</p>
          </div>
        </div>
      </div>

      {/* 参与者列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">
          参与者
        </h3>
        {currentMeeting.participants && currentMeeting.participants.length > 0 ? (
          <div>
            {currentMeeting.participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0"
                data-testid="participant-item"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">👤</span>
                  <span className="text-sm text-gray-900">
                    {participant.nickname}
                    {participant.isCreator && (
                      <span className="ml-1 text-xs text-gray-400">（创建者）</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  加入于 {formatDateTime(participant.joinedAt).split(' ')[1]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-gray-400">暂无参与者</p>
        )}
      </div>

      {/* 操作按钮（仅进行中会议显示） */}
      {isActive && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleRejoin}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            data-testid="rejoin-button"
          >
            重新加入会议
          </button>
          {isCreator && (
            <button
              onClick={() => setShowEndModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              data-testid="end-meeting-button"
            >
              结束会议
            </button>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 结束会议确认弹窗 */}
      <EndMeetingModal
        isOpen={showEndModal}
        isEnding={isEnding}
        onConfirm={handleEndMeeting}
        onCancel={() => setShowEndModal(false)}
      />
    </div>
  );
};

export default MeetingDetailPage;

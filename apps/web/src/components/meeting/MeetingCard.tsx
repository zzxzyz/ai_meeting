import React, { useState } from 'react';
import { Meeting, MeetingStatus, formatMeetingNumber } from '../../api/meeting';
import { MeetingStatusBadge } from './MeetingStatusBadge';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin?: (meeting: Meeting) => void;
  onViewDetail?: (meeting: Meeting) => void;
}

/**
 * 格式化时间显示
 * 当天显示 HH:MM，其他显示 MM-DD
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  }
}

/**
 * 会议列表卡片组件
 */
export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onJoin,
  onViewDetail,
}) => {
  const [copied, setCopied] = useState(false);

  const isActive = meeting.status === MeetingStatus.IN_PROGRESS;
  const formattedNumber = formatMeetingNumber(meeting.meetingNumber);
  const timeLabel = formatTime(meeting.createdAt);
  const titleDisplay = meeting.title
    ? meeting.title.length > 20
      ? meeting.title.slice(0, 20) + '...'
      : meeting.title
    : '未命名会议';

  const handleCopyMeetingNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(formattedNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败时降级处理
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      data-testid="meeting-card"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* 会议号 */}
        <button
          onClick={handleCopyMeetingNumber}
          title={copied ? '已复制' : '点击复制会议号'}
          className="font-mono text-sm text-gray-700 hover:text-blue-600 flex-shrink-0"
          data-testid="meeting-number"
        >
          {formattedNumber}
        </button>

        {/* 标题 */}
        <span className="text-sm text-gray-900 truncate flex-1" title={meeting.title || ''}>
          {titleDisplay}
        </span>

        {/* 状态徽章 */}
        <MeetingStatusBadge status={meeting.status} />

        {/* 时间 */}
        <span className="text-xs text-gray-400 flex-shrink-0">{timeLabel}</span>
      </div>

      {/* 操作按钮 */}
      <div className="ml-4 flex-shrink-0">
        {isActive ? (
          <button
            onClick={() => onJoin?.(meeting)}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            data-testid="join-button"
          >
            加入
          </button>
        ) : (
          <button
            onClick={() => onViewDetail?.(meeting)}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            data-testid="detail-button"
          >
            详情
          </button>
        )}
      </div>
    </div>
  );
};

export default MeetingCard;

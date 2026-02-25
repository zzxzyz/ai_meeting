import React from 'react';
import { MeetingStatus } from '../../api/meeting';

interface MeetingStatusBadgeProps {
  status: MeetingStatus;
  className?: string;
}

const STATUS_CONFIG = {
  [MeetingStatus.IN_PROGRESS]: {
    label: '进行中',
    className: 'bg-green-100 text-green-700',
  },
  [MeetingStatus.ENDED]: {
    label: '已结束',
    className: 'bg-gray-100 text-gray-500',
  },
  [MeetingStatus.WAITING]: {
    label: '未开始',
    className: 'bg-blue-100 text-blue-700',
  },
};

/**
 * 会议状态徽章组件
 */
export const MeetingStatusBadge: React.FC<MeetingStatusBadgeProps> = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[MeetingStatus.ENDED];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
      data-testid="meeting-status-badge"
    >
      {config.label}
    </span>
  );
};

export default MeetingStatusBadge;

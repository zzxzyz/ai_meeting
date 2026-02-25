import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock api/client 模块以避免 import.meta 问题
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  tokenManager: { hasTokens: jest.fn(() => false) },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string) { super(message); }
  },
}));

// Mock meeting API 模块
const mockFormatMeetingNumber = jest.fn((num: string) => {
  const digits = num.replace(/\D/g, '');
  if (digits.length !== 9) return num;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
});

jest.mock('../../../../apps/web/src/api/meeting', () => ({
  MeetingStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
  },
  parseMeetingNumber: (input: string) => input.replace(/\D/g, ''),
  formatMeetingNumber: mockFormatMeetingNumber,
}));

import { MeetingCard } from '../../../../apps/web/src/components/Meeting/MeetingCard';
import { MeetingStatus, Meeting } from '../../../../apps/web/src/api/meeting';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

const mockMeetingInProgress: Meeting = {
  id: 'meeting-uuid-001',
  meetingNumber: '123456789',
  title: '产品评审会议',
  status: MeetingStatus.IN_PROGRESS,
  creatorId: 'user-uuid-001',
  startedAt: '2026-02-25T14:30:00.000Z',
  endedAt: null,
  participantCount: 3,
  createdAt: new Date().toISOString(), // 今天
};

const mockMeetingEnded: Meeting = {
  id: 'meeting-uuid-002',
  meetingNumber: '987654321',
  title: '技术架构讨论',
  status: MeetingStatus.ENDED,
  creatorId: 'user-uuid-001',
  startedAt: '2026-02-24T10:00:00.000Z',
  endedAt: '2026-02-24T12:00:00.000Z',
  participantCount: 5,
  createdAt: '2026-02-24T10:00:00.000Z',
};

describe('MeetingCard', () => {
  const mockOnJoin = jest.fn();
  const mockOnViewDetail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该渲染会议卡片', () => {
      render(
        <MeetingCard meeting={mockMeetingInProgress} />
      );
      expect(screen.getByTestId('meeting-card')).toBeInTheDocument();
    });

    it('应该显示格式化的会议号', () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      expect(screen.getByTestId('meeting-number')).toHaveTextContent('123-456-789');
    });

    it('应该显示会议标题', () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      expect(screen.getByText('产品评审会议')).toBeInTheDocument();
    });

    it('没有标题时应该显示"未命名会议"', () => {
      const noTitleMeeting = { ...mockMeetingInProgress, title: null };
      render(<MeetingCard meeting={noTitleMeeting} />);
      expect(screen.getByText('未命名会议')).toBeInTheDocument();
    });

    it('标题超过20字时应该截断并显示省略号', () => {
      const longTitleMeeting = {
        ...mockMeetingInProgress,
        title: '这是一个很长的会议标题超过二十个字符的内容',
      };
      render(<MeetingCard meeting={longTitleMeeting} />);
      const titleEl = screen.getByText(/这是一个很长的会议标题超过二十/);
      expect(titleEl.textContent).toContain('...');
    });

    it('应该显示状态徽章', () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      expect(screen.getByTestId('meeting-status-badge')).toBeInTheDocument();
    });
  });

  describe('进行中会议', () => {
    it('应该显示"加入"按钮', () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      expect(screen.getByTestId('join-button')).toBeInTheDocument();
      expect(screen.getByTestId('join-button')).toHaveTextContent('加入');
    });

    it('不应该显示"详情"按钮', () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      expect(screen.queryByTestId('detail-button')).not.toBeInTheDocument();
    });

    it('点击"加入"按钮应该调用 onJoin 回调', () => {
      render(
        <MeetingCard
          meeting={mockMeetingInProgress}
          onJoin={mockOnJoin}
        />
      );
      fireEvent.click(screen.getByTestId('join-button'));
      expect(mockOnJoin).toHaveBeenCalledWith(mockMeetingInProgress);
    });
  });

  describe('已结束会议', () => {
    it('应该显示"详情"按钮', () => {
      render(<MeetingCard meeting={mockMeetingEnded} />);
      expect(screen.getByTestId('detail-button')).toBeInTheDocument();
      expect(screen.getByTestId('detail-button')).toHaveTextContent('详情');
    });

    it('不应该显示"加入"按钮', () => {
      render(<MeetingCard meeting={mockMeetingEnded} />);
      expect(screen.queryByTestId('join-button')).not.toBeInTheDocument();
    });

    it('点击"详情"按钮应该调用 onViewDetail 回调', () => {
      render(
        <MeetingCard
          meeting={mockMeetingEnded}
          onViewDetail={mockOnViewDetail}
        />
      );
      fireEvent.click(screen.getByTestId('detail-button'));
      expect(mockOnViewDetail).toHaveBeenCalledWith(mockMeetingEnded);
    });
  });

  describe('复制会议号', () => {
    it('点击会议号应该复制到剪贴板', async () => {
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      fireEvent.click(screen.getByTestId('meeting-number'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('123-456-789');
    });
  });

  describe('时间显示', () => {
    it('今天的会议应该显示 HH:MM 格式', () => {
      // mockMeetingInProgress 的 createdAt 是今天
      render(<MeetingCard meeting={mockMeetingInProgress} />);
      // 时间格式为 HH:MM
      const timeEl = screen.getByText(/^\d{2}:\d{2}$/);
      expect(timeEl).toBeInTheDocument();
    });

    it('历史会议应该显示 MM-DD 格式', () => {
      render(<MeetingCard meeting={mockMeetingEnded} />);
      // 2026-02-24 的会议
      const timeEl = screen.getByText(/^02-24$/);
      expect(timeEl).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';

// 手动定义 MeetingStatus 枚举，避免导入带有 import.meta 的模块
enum MeetingStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  ENDED = 'ENDED',
}

// Mock meeting API 模块
jest.mock('../../../../apps/web/src/api/meeting', () => ({
  MeetingStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
  },
}));

// Mock api/client 模块以避免 import.meta 问题
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  tokenManager: { hasTokens: jest.fn(() => false) },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string) { super(message); }
  },
}));

import { MeetingStatusBadge } from '../../../../apps/web/src/components/Meeting/MeetingStatusBadge';

describe('MeetingStatusBadge', () => {
  describe('IN_PROGRESS 状态', () => {
    it('应该显示"进行中"文字', () => {
      render(<MeetingStatusBadge status={MeetingStatus.IN_PROGRESS} />);
      expect(screen.getByText('进行中')).toBeInTheDocument();
    });

    it('应该使用绿色样式', () => {
      render(<MeetingStatusBadge status={MeetingStatus.IN_PROGRESS} />);
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.className).toContain('bg-green-100');
      expect(badge.className).toContain('text-green-700');
    });
  });

  describe('ENDED 状态', () => {
    it('应该显示"已结束"文字', () => {
      render(<MeetingStatusBadge status={MeetingStatus.ENDED} />);
      expect(screen.getByText('已结束')).toBeInTheDocument();
    });

    it('应该使用灰色样式', () => {
      render(<MeetingStatusBadge status={MeetingStatus.ENDED} />);
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.className).toContain('bg-gray-100');
      expect(badge.className).toContain('text-gray-500');
    });
  });

  describe('WAITING 状态', () => {
    it('应该显示"未开始"文字', () => {
      render(<MeetingStatusBadge status={MeetingStatus.WAITING} />);
      expect(screen.getByText('未开始')).toBeInTheDocument();
    });

    it('应该使用蓝色样式', () => {
      render(<MeetingStatusBadge status={MeetingStatus.WAITING} />);
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.className).toContain('bg-blue-100');
      expect(badge.className).toContain('text-blue-700');
    });
  });

  describe('自定义 className', () => {
    it('应该支持传入额外的 className', () => {
      render(
        <MeetingStatusBadge status={MeetingStatus.IN_PROGRESS} className="extra-class" />
      );
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.className).toContain('extra-class');
    });
  });

  describe('渲染结构', () => {
    it('应该渲染一个 span 标签', () => {
      render(<MeetingStatusBadge status={MeetingStatus.IN_PROGRESS} />);
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.tagName.toLowerCase()).toBe('span');
    });

    it('应该包含 rounded-full 样式', () => {
      render(<MeetingStatusBadge status={MeetingStatus.IN_PROGRESS} />);
      const badge = screen.getByTestId('meeting-status-badge');
      expect(badge.className).toContain('rounded-full');
    });
  });
});

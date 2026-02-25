import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock api/client 模块以避免 import.meta 问题
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  tokenManager: { hasTokens: jest.fn(() => false) },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string) { super(message); }
  },
}));

import { EndMeetingModal } from '../../../../apps/web/src/components/Meeting/EndMeetingModal';

describe('EndMeetingModal', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isOpen=false 时', () => {
    it('不应该渲染弹窗', () => {
      render(
        <EndMeetingModal
          isOpen={false}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.queryByTestId('end-meeting-modal')).not.toBeInTheDocument();
    });
  });

  describe('isOpen=true 时', () => {
    it('应该渲染弹窗', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('end-meeting-modal')).toBeInTheDocument();
    });

    it('应该显示弹窗标题', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getAllByText('结束会议').length).toBeGreaterThanOrEqual(1);
    });

    it('应该显示确认文字', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText('确认要结束本次会议吗？')).toBeInTheDocument();
    });

    it('应该显示警告文字', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText(/此操作不可撤销/)).toBeInTheDocument();
    });

    it('应该显示取消按钮', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('cancel-end-button')).toBeInTheDocument();
    });

    it('应该显示确认结束按钮', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('confirm-end-button')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-end-button')).toHaveTextContent('结束会议');
    });

    it('点击取消按钮应该调用 onCancel', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      fireEvent.click(screen.getByTestId('cancel-end-button'));
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('点击确认结束按钮应该调用 onConfirm', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      fireEvent.click(screen.getByTestId('confirm-end-button'));
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it('点击关闭按钮应该调用 onCancel', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      fireEvent.click(screen.getByLabelText('关闭'));
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('isEnding=true 时', () => {
    it('确认按钮应该显示"结束中..."', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('confirm-end-button')).toHaveTextContent('结束中...');
    });

    it('取消按钮应该被禁用', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('cancel-end-button')).toBeDisabled();
    });

    it('确认按钮应该被禁用', () => {
      render(
        <EndMeetingModal
          isOpen={true}
          isEnding={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('confirm-end-button')).toBeDisabled();
    });
  });
});

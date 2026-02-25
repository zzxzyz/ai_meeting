import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock api/client 模块以避免 import.meta 问题
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  tokenManager: { hasTokens: jest.fn(() => false) },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string) { super(message); }
  },
}));

// Mock auth API
jest.mock('../../../../apps/web/src/api/auth', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// Mock authStore
jest.mock('../../../../apps/web/src/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'user-001', nickname: '张三' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
  })),
}));

// Mock meeting API
jest.mock('../../../../apps/web/src/api/meeting', () => ({
  MeetingStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
  },
  formatMeetingNumber: (num: string) => {
    const d = num.replace(/\D/g, '');
    if (d.length !== 9) return num;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}`;
  },
  parseMeetingNumber: (input: string) => input.replace(/\D/g, ''),
}));

jest.mock('../../../../apps/web/src/stores/meetingStore');
jest.mock('../../../../apps/web/src/hooks/useAuth');

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

import { CreateMeetingModal } from '../../../../apps/web/src/components/Meeting/CreateMeetingModal';
import { useMeetingStore } from '../../../../apps/web/src/stores/meetingStore';
import { useAuth } from '../../../../apps/web/src/hooks/useAuth';
import { MeetingStatus } from '../../../../apps/web/src/api/meeting';

const mockCreatedMeeting = {
  id: 'meeting-uuid-001',
  meetingNumber: '123456789',
  title: '产品评审会议',
  status: MeetingStatus.IN_PROGRESS,
  creatorId: 'user-uuid-001',
  startedAt: '2026-02-25T14:30:00.000Z',
  endedAt: null,
  participantCount: 1,
  createdAt: '2026-02-25T14:30:00.000Z',
};

describe('CreateMeetingModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockCreateMeeting = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useMeetingStore as unknown as jest.Mock).mockReturnValue({
      isCreating: false,
      error: null,
      createMeeting: mockCreateMeeting,
      clearError: mockClearError,
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-001', nickname: '张三' },
    });
  });

  const renderModal = (isOpen = true) => {
    return render(
      <BrowserRouter>
        <CreateMeetingModal
          isOpen={isOpen}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </BrowserRouter>
    );
  };

  describe('isOpen=false 时', () => {
    it('不应该渲染弹窗', () => {
      renderModal(false);
      expect(screen.queryByTestId('create-meeting-modal')).not.toBeInTheDocument();
    });
  });

  describe('isOpen=true 时 - 表单步骤', () => {
    it('应该显示创建会议弹窗', () => {
      renderModal();
      expect(screen.getByTestId('create-meeting-modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '创建会议' })).toBeInTheDocument();
    });

    it('应该显示标题输入框', () => {
      renderModal();
      expect(screen.getByTestId('meeting-title-input')).toBeInTheDocument();
    });

    it('应该显示创建会议按钮', () => {
      renderModal();
      expect(screen.getByTestId('create-confirm-button')).toBeInTheDocument();
    });

    it('点击关闭按钮应该调用 onClose', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('关闭'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('点击取消按钮应该调用 onClose', () => {
      renderModal();
      fireEvent.click(screen.getByText('取消'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('点击创建按钮时应该调用 createMeeting', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.change(screen.getByTestId('meeting-title-input'), {
        target: { value: '产品评审会议' },
      });
      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(mockCreateMeeting).toHaveBeenCalledWith({ title: '产品评审会议' });
      });
    });

    it('创建时不填标题应该使用用户昵称作为默认标题', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(mockCreateMeeting).toHaveBeenCalledWith({ title: '张三的会议' });
      });
    });

    it('isCreating=true 时按钮应该显示"创建中..."', () => {
      (useMeetingStore as unknown as jest.Mock).mockReturnValue({
        isCreating: true,
        error: null,
        createMeeting: mockCreateMeeting,
        clearError: mockClearError,
      });
      renderModal();
      expect(screen.getByTestId('create-confirm-button')).toHaveTextContent('创建中...');
      expect(screen.getByTestId('create-confirm-button')).toBeDisabled();
    });

    it('有错误时应该显示错误信息', () => {
      (useMeetingStore as unknown as jest.Mock).mockReturnValue({
        isCreating: false,
        error: '创建会议失败，请稍后重试',
        createMeeting: mockCreateMeeting,
        clearError: mockClearError,
      });
      renderModal();
      expect(screen.getByTestId('create-error')).toBeInTheDocument();
      expect(screen.getByText('创建会议失败，请稍后重试')).toBeInTheDocument();
    });
  });

  describe('创建成功后 - 成功步骤', () => {
    it('创建成功后应该显示会议号', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('created-meeting-number')).toBeInTheDocument();
        expect(screen.getByTestId('created-meeting-number')).toHaveTextContent('123-456-789');
      });
    });

    it('应该显示"复制会议号"按钮', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('copy-meeting-number-button')).toBeInTheDocument();
      });
    });

    it('点击"复制会议号"应该复制到剪贴板', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('copy-meeting-number-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('copy-meeting-number-button'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('123-456-789');
    });

    it('点击"立即进入会议"应该调用 onSuccess', async () => {
      mockCreateMeeting.mockResolvedValueOnce(mockCreatedMeeting);
      renderModal();

      fireEvent.click(screen.getByTestId('create-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('enter-meeting-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('enter-meeting-button'));
      expect(mockOnSuccess).toHaveBeenCalledWith('meeting-uuid-001', '123456789');
    });
  });
});

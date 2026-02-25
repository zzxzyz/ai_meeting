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
jest.mock('../../../../apps/web/src/api/meeting', () => ({
  MeetingStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
  },
  parseMeetingNumber: (input: string) => input.replace(/\D/g, ''),
  formatMeetingNumber: (meetingNumber: string) => {
    const digits = meetingNumber.replace(/\D/g, '');
    if (digits.length !== 9) return meetingNumber;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  },
}));

import { JoinMeetingInput } from '../../../../apps/web/src/components/Meeting/JoinMeetingInput';

describe('JoinMeetingInput', () => {
  const mockOnChange = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该渲染输入框', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      expect(screen.getByTestId('join-meeting-input')).toBeInTheDocument();
    });

    it('应该显示 placeholder 文字', () => {
      render(
        <JoinMeetingInput
          value=""
          onChange={mockOnChange}
          placeholder="请输入 9 位会议号"
        />
      );
      expect(screen.getByPlaceholderText('请输入 9 位会议号')).toBeInTheDocument();
    });

    it('应该在有错误时显示错误信息', () => {
      render(
        <JoinMeetingInput
          value=""
          onChange={mockOnChange}
          error="请输入完整的 9 位会议号"
        />
      );
      expect(screen.getByTestId('join-meeting-error')).toBeInTheDocument();
      expect(screen.getByText('请输入完整的 9 位会议号')).toBeInTheDocument();
    });

    it('没有错误时不应该显示错误信息', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      expect(screen.queryByTestId('join-meeting-error')).not.toBeInTheDocument();
    });

    it('disabled 时输入框应该被禁用', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} disabled={true} />);
      expect(screen.getByTestId('join-meeting-input')).toBeDisabled();
    });
  });

  describe('自动格式化', () => {
    it('输入3位数字时不应该添加分隔符', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '123' } });
      expect(input.value).toBe('123');
    });

    it('输入4位数字时应该在第3位后添加分隔符', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '1234' } });
      expect(input.value).toBe('123-4');
    });

    it('输入9位数字时应该显示 XXX-XXX-XXX 格式', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '123456789' } });
      expect(input.value).toBe('123-456-789');
    });

    it('输入包含非数字字符时应该过滤掉', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abc123' } });
      expect(input.value).toBe('123');
    });

    it('超过9位时应该截断', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '1234567890' } });
      expect(input.value).toBe('123-456-789');
    });
  });

  describe('onChange 回调', () => {
    it('输入时应该调用 onChange，传入纯数字', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input');
      fireEvent.change(input, { target: { value: '123456789' } });
      expect(mockOnChange).toHaveBeenCalledWith('123456789');
    });

    it('输入带格式的数字时应该传入纯数字', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input');
      fireEvent.change(input, { target: { value: '123-456-789' } });
      expect(mockOnChange).toHaveBeenCalledWith('123456789');
    });
  });

  describe('Enter 键提交', () => {
    it('按 Enter 键时应该调用 onSubmit', () => {
      render(
        <JoinMeetingInput value="" onChange={mockOnChange} onSubmit={mockOnSubmit} />
      );
      const input = screen.getByTestId('join-meeting-input');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('未提供 onSubmit 时按 Enter 不应报错', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input');
      expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
    });

    it('按其他键时不应该调用 onSubmit', () => {
      render(
        <JoinMeetingInput value="" onChange={mockOnChange} onSubmit={mockOnSubmit} />
      );
      const input = screen.getByTestId('join-meeting-input');
      fireEvent.keyDown(input, { key: 'Space' });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('错误样式', () => {
    it('有错误时输入框应该有红色边框样式', () => {
      render(
        <JoinMeetingInput
          value=""
          onChange={mockOnChange}
          error="错误信息"
        />
      );
      const input = screen.getByTestId('join-meeting-input');
      expect(input.className).toContain('border-red-500');
    });

    it('无错误时输入框不应该有红色边框样式', () => {
      render(<JoinMeetingInput value="" onChange={mockOnChange} />);
      const input = screen.getByTestId('join-meeting-input');
      expect(input.className).not.toContain('border-red-500');
    });
  });
});

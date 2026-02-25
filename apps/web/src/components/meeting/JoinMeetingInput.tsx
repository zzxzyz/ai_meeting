import React, { useState, useCallback } from 'react';
import { parseMeetingNumber } from '../../api/meeting';

interface JoinMeetingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 加入会议输入框组件
 * 自动格式化为 XXX-XXX-XXX 格式，只允许输入数字
 */
export const JoinMeetingInput: React.FC<JoinMeetingInputProps> = ({
  value,
  onChange,
  onSubmit,
  error,
  disabled = false,
  placeholder = '请输入会议号',
}) => {
  const [displayValue, setDisplayValue] = useState(() => {
    const digits = parseMeetingNumber(value);
    return formatDisplay(digits);
  });

  function formatDisplay(digits: string): string {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      // 只保留数字
      const digits = rawInput.replace(/\D/g, '').slice(0, 9);
      const formatted = formatDisplay(digits);
      setDisplayValue(formatted);
      onChange(digits);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSubmit) {
        onSubmit();
      }
    },
    [onSubmit]
  );

  return (
    <div className="w-full">
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-4 py-2 text-center font-mono text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
        inputMode="numeric"
        aria-label="会议号输入"
        data-testid="join-meeting-input"
      />
      {error && (
        <p className="mt-1 text-sm text-red-600" data-testid="join-meeting-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default JoinMeetingInput;

import React, { useState } from 'react';
import { useMeetingStore } from '../../stores/meetingStore';
import { useAuth } from '../../hooks/useAuth';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (meetingId: string, meetingNumber: string) => void;
}

type ModalStep = 'form' | 'success';

/**
 * 创建会议弹窗组件
 */
export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('form');
  const [title, setTitle] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState<{ id: string; meetingNumber: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { user } = useAuth();
  const { isCreating, error, createMeeting, clearError } = useMeetingStore();

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('form');
    setTitle('');
    setCreatedMeeting(null);
    setCopied(false);
    clearError();
    onClose();
  };

  const handleCreate = async () => {
    const meetingTitle = title.trim() || (user ? `${user.nickname}的会议` : '我的会议');
    try {
      const meeting = await createMeeting({ title: meetingTitle });
      setCreatedMeeting({ id: meeting.id, meetingNumber: meeting.meetingNumber });
      setStep('success');
    } catch {
      // 错误已在 store 中处理
    }
  };

  const handleCopy = async () => {
    if (!createdMeeting) return;
    const formatted = `${createdMeeting.meetingNumber.slice(0, 3)}-${createdMeeting.meetingNumber.slice(3, 6)}-${createdMeeting.meetingNumber.slice(6, 9)}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败
    }
  };

  const handleEnterMeeting = () => {
    if (createdMeeting) {
      onSuccess?.(createdMeeting.id, createdMeeting.meetingNumber);
    }
    handleClose();
  };

  const formattedNumber = createdMeeting
    ? `${createdMeeting.meetingNumber.slice(0, 3)}-${createdMeeting.meetingNumber.slice(3, 6)}-${createdMeeting.meetingNumber.slice(6, 9)}`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      data-testid="create-meeting-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {step === 'form' ? (
          <>
            {/* 表单步骤 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">创建会议</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会议标题（可选）
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                placeholder={`例：${user?.nickname || ''}的会议`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="meeting-title-input"
              />
              <p className="mt-1 text-xs text-gray-400">最多 50 个字符</p>

              {error && (
                <p className="mt-2 text-sm text-red-600" data-testid="create-error">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-confirm-button"
              >
                {isCreating ? '创建中...' : '创建会议'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 成功步骤 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">会议创建成功！</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6 text-center">
              <div className="text-green-500 text-4xl mb-3">✓</div>
              <p className="text-gray-600 mb-4">会议已就绪</p>
              <p className="text-sm text-gray-500 mb-2">您的会议号</p>
              <div className="bg-gray-50 rounded-lg px-6 py-3 mb-4">
                <span
                  className="font-mono text-2xl font-bold text-gray-900 tracking-wider"
                  data-testid="created-meeting-number"
                >
                  {formattedNumber}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                data-testid="copy-meeting-number-button"
              >
                {copied ? '已复制' : '复制会议号'}
              </button>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={handleEnterMeeting}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                data-testid="enter-meeting-button"
              >
                立即进入会议
              </button>
              <button
                onClick={handleClose}
                className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                稍后进入（关闭此窗口）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateMeetingModal;

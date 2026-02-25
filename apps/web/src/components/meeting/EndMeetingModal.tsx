import React from 'react';

interface EndMeetingModalProps {
  isOpen: boolean;
  isEnding: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 结束会议确认弹窗组件
 */
export const EndMeetingModal: React.FC<EndMeetingModalProps> = ({
  isOpen,
  isEnding,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      data-testid="end-meeting-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-yellow-500">⚠</span>
            结束会议
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            aria-label="关闭"
            disabled={isEnding}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-gray-700 mb-2">确认要结束本次会议吗？</p>
          <p className="text-gray-500 text-sm">
            所有参与者将被移出会议，此操作不可撤销。
          </p>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={isEnding}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cancel-end-button"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isEnding}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="confirm-end-button"
          >
            {isEnding ? '结束中...' : '结束会议'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndMeetingModal;

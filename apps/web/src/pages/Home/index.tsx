import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMeetingStore } from '../../stores/meetingStore';
import { CreateMeetingModal } from '../../components/meeting/CreateMeetingModal';
import { JoinMeetingInput } from '../../components/meeting/JoinMeetingInput';
import { MeetingCard } from '../../components/meeting/MeetingCard';
import { Meeting } from '../../api/meeting';

/**
 * 首页 / 会议入口页面
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meetings, isLoading, isJoining, error, fetchMeetings, joinMeeting, clearError } = useMeetingStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinMeetingNumber, setJoinMeetingNumber] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // 加载最近的会议列表（最多3条）
  useEffect(() => {
    fetchMeetings({ page: 1, pageSize: 3 });
  }, [fetchMeetings]);

  const handleJoin = async () => {
    setJoinError(null);
    if (joinMeetingNumber.length !== 9) {
      setJoinError('请输入完整的 9 位会议号');
      return;
    }
    try {
      const meetingDetail = await joinMeeting({ meetingNumber: joinMeetingNumber });
      navigate(`/meetings/${meetingDetail.id}`);
    } catch (err: any) {
      setJoinError(err.message || '加入会议失败，请稍后重试');
    }
  };

  const handleCreateSuccess = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

  const handleCardJoin = (meeting: Meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const handleCardDetail = (meeting: Meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  return (
    <div className="px-4 py-6 sm:px-0" data-testid="home-page">
      {/* 欢迎语 */}
      <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">
        欢迎回来，{user?.nickname || '用户'}
      </h2>

      {/* 创建/加入会议卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 创建会议卡片 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
          <div className="text-4xl mb-3">📹</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">创建会议</h3>
          <p className="text-sm text-gray-500 mb-4">立即发起一场会议</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="create-meeting-button"
          >
            创建会议
          </button>
        </div>

        {/* 加入会议卡片 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
          <div className="text-4xl mb-3">🔗</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">加入会议</h3>
          <p className="text-sm text-gray-500 mb-4">输入会议号</p>
          <div className="w-full max-w-xs">
            <JoinMeetingInput
              value={joinMeetingNumber}
              onChange={(val: string) => {
                setJoinMeetingNumber(val);
                setJoinError(null);
              }}
              onSubmit={handleJoin}
              error={joinError}
              disabled={isJoining}
              placeholder="请输入 9 位会议号"
            />
            <button
              onClick={handleJoin}
              disabled={isJoining || joinMeetingNumber.length === 0}
              className="mt-3 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="join-meeting-button"
            >
              {isJoining ? '加入中...' : '加入会议'}
            </button>
          </div>
        </div>
      </div>

      {/* 最近的会议列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">最近的会议</h3>
          <button
            onClick={() => navigate('/meetings')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            查看全部 &gt;
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (meetings ?? []).length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            暂无会议记录
          </div>
        ) : (
          <div>
            {(meetings ?? []).map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onJoin={handleCardJoin}
                onViewDetail={handleCardDetail}
              />
            ))}
          </div>
        )}
      </div>

      {/* 全局错误提示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 创建会议弹窗 */}
      <CreateMeetingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default HomePage;

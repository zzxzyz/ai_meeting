import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeetingStore } from '../../stores/meetingStore';
import { MeetingCard } from '../../components/meeting/MeetingCard';
import { Meeting } from '../../api/meeting';

type TabType = 'created' | 'joined';

/**
 * 会议列表页面
 */
export const MeetingListPage: React.FC = () => {
  const navigate = useNavigate();
  const { meetings, meetingListData, isLoading, error, activeTab, setActiveTab, fetchMeetings, clearError } =
    useMeetingStore();

  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 切换 tab 或翻页时加载数据
  useEffect(() => {
    fetchMeetings({ type: activeTab, page, pageSize });
  }, [activeTab, page, fetchMeetings]);

  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setPage(1);
    }
  };

  const handleCardJoin = (meeting: Meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const handleCardDetail = (meeting: Meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const totalPages = meetingListData ? Math.ceil(meetingListData.total / pageSize) : 1;

  return (
    <div className="px-4 py-6 sm:px-0" data-testid="meeting-list-page">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">我的会议</h2>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => handleTabChange('created')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'created'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-created"
        >
          我创建的会议
        </button>
        <button
          onClick={() => handleTabChange('joined')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'joined'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-joined"
        >
          我参加的会议
        </button>
      </div>

      {/* 列表内容 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* 表头 */}
        <div className="grid grid-cols-5 gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500">
          <span>会议号</span>
          <span className="col-span-2">标题</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">加载中...</p>
          </div>
        ) : (meetings ?? []).length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-600 mb-1">暂无会议记录</p>
            {activeTab === 'created' ? (
              <>
                <p className="text-sm text-gray-400 mb-4">点击"创建会议"发起您的第一场会议</p>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  创建会议
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">暂未参加过任何会议，输入会议号加入</p>
            )}
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

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6" data-testid="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 text-sm rounded-md ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
    </div>
  );
};

export default MeetingListPage;

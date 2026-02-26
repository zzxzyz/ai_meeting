import React from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
// 复用 Web 端的认证页面
import { Login } from '@web/pages/Login';
import { Register } from '@web/pages/Register';
import { PrivateRoute } from '@web/components/PrivateRoute';
import { useAuth } from '@web/hooks/useAuth';
// REQ-004 音视频控制演示页面
import { MediaControlDemo } from './pages/MediaControlDemo';

// 会议管理页面（Web 端实现后复用）
// 当 Web 端完成 REQ-002 实现时，取消注释以下导入：
// import { HomePage } from '@web/pages/HomePage';
// import { MeetingListPage } from '@web/pages/MeetingListPage';
// import { MeetingDetailPage } from '@web/pages/MeetingDetailPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/media-demo" element={<MediaControlDemo />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        {/* 会议列表页 */}
        <Route path="meetings" element={<MeetingListPage />} />
        {/* 会议详情页 */}
        <Route path="meetings/:id" element={<MeetingDetailPage />} />
      </Route>
    </Routes>
  );
}

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-blue-600">
              AI Meeting
            </Link>
            <nav className="flex gap-4">
              <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
                首页
              </Link>
              <Link to="/meetings" className="text-sm text-gray-600 hover:text-gray-900">
                我的会议
              </Link>
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">欢迎，{user.nickname}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="meetings" element={<MeetingListPage />} />
            <Route path="meetings/:id" element={<MeetingDetailPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

// 占位首页 - 将在 Web 端完成 REQ-002 后替换为 @web/pages/HomePage
function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">欢迎使用 AI Meeting</h2>
        <p className="text-gray-500">企业级视频会议系统</p>
      </div>
      <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* 创建会议卡片 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-3xl mb-3">📹</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">创建会议</h3>
          <p className="text-sm text-gray-500 mb-4">立即发起一场会议</p>
          <button
            onClick={() => navigate('/meetings')}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            创建会议
          </button>
        </div>

        {/* 加入会议卡片 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-3xl mb-3">🔗</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">加入会议</h3>
          <p className="text-sm text-gray-500 mb-4">输入会议号加入</p>
          <button
            onClick={() => navigate('/meetings')}
            className="w-full px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50"
          >
            加入会议
          </button>
        </div>
      </div>

      {/* 最近会议区域 */}
      <div className="mt-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium text-gray-900">最近的会议</h3>
          <Link to="/meetings" className="text-sm text-blue-600 hover:underline">
            查看全部 &gt;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            暂无会议记录，点击"创建会议"发起您的第一场会议
          </p>
        </div>
      </div>
    </div>
  );
}

// 占位会议列表页 - 将在 Web 端完成 REQ-002 后替换为 @web/pages/MeetingListPage
function MeetingListPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">我的会议</h2>
      <p className="text-gray-500 text-sm">
        会议管理功能开发中，等待 Web 端 REQ-002 完成后集成。
      </p>
    </div>
  );
}

// 占位会议详情页 - 将在 Web 端完成 REQ-002 后替换为 @web/pages/MeetingDetailPage
function MeetingDetailPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <Link to="/meetings" className="text-sm text-blue-600 hover:underline">
        ← 返回列表
      </Link>
      <h2 className="text-2xl font-semibold text-gray-900 mt-4 mb-6">会议详情</h2>
      <p className="text-gray-500 text-sm">
        会议详情功能开发中，等待 Web 端 REQ-002 完成后集成。
      </p>
    </div>
  );
}

export default App;

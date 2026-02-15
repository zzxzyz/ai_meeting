import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '@ai-meeting/ui';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PrivateRoute } from './components/PrivateRoute';
import { useAuth } from './hooks/useAuth';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="meeting/:id" element={<MeetingPage />} />
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">AI Meeting</h1>
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
            <Route path="meeting/:id" element={<MeetingPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">欢迎使用 AI Meeting</h2>
        <p className="text-gray-600 mb-8">企业级视频会议系统 MVP v0.1</p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">创建会议</Button>
          <Button variant="secondary">加入会议</Button>
        </div>
      </div>
    </div>
  );
}

function MeetingPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-semibold mb-4">会议室</h2>
      <p className="text-gray-600">会议功能开发中...</p>
    </div>
  );
}

export default App;

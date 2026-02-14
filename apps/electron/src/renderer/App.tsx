import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Button } from '@ai-meeting/ui';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Meeting</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/meeting/:id" element={<MeetingPage />} />
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

import { Routes, Route, useNavigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PrivateRoute } from './components/PrivateRoute';
import { useAuth } from './hooks/useAuth';
import { HomePage } from './pages/Home/index';
import { MeetingListPage } from './pages/MeetingList/index';
import { MeetingDetailPage } from './pages/MeetingDetail/index';

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
        <Route path="meetings" element={<MeetingListPage />} />
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
          <button
            onClick={() => navigate('/')}
            className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            AI Meeting
          </button>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.nickname}</span>
              <button
                onClick={() => navigate('/meetings')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                我的会议
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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

export default App;

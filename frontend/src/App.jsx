import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import useAuth from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MemberList from './pages/Members/MemberList';
import CommunicationPanel from './pages/Communication/CommunicationPanel';
import PrayerRequest from './pages/PrayerRequest';
import UserManagement from './pages/Users/UserManagement';
import ExternalMemberForm from './pages/ExternalMemberForm';
import EbdList from './pages/EBD/EbdList';
import EbdChamada from './pages/EBD/EbdChamada';
import EbdRelatorio from './pages/EBD/EbdRelatorio';
import Profile from './pages/Profile';

export default function App() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ibbiCream">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/external/:token" element={<ExternalMemberForm />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute user={user}>
              <div className="flex min-h-screen">
                <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                {sidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black/40 z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                  />
                )}
                <main className="flex-1 p-4 md:p-10 ml-0 md:ml-0">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      className="md:hidden border rounded-lg px-3 py-2"
                      onClick={() => setSidebarOpen(true)}
                    >
                      Menu
                    </button>
                  </div>
                  <Routes>
                    {user?.role !== 'user' && (
                      <>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/members" element={<MemberList />} />
                        <Route path="/communication" element={<CommunicationPanel />} />
                        <Route path="/ebd" element={<EbdList />} />
                        <Route path="/ebd/:id" element={<EbdChamada />} />
                        <Route path="/ebd/relatorios" element={<EbdRelatorio />} />
                        <Route path="/users" element={<UserManagement />} />
                      </>
                    )}
                    <Route path="/prayer" element={<PrayerRequest />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<Navigate to={user?.role === 'user' ? '/profile' : '/dashboard'} replace />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

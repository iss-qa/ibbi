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
import UserCarteirinha from './pages/UserCarteirinha';
import UserCertificado from './pages/UserCertificado';
import GruposTriagem from './pages/GruposTriagem';
import GrupoDetalhe from './pages/GrupoDetalhe';
import ProjetoAmigoDash from './pages/ProjetoAmigoDash';

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
                <main className="flex-1 p-4 md:p-10 ml-0 relative max-w-full lg:max-w-[calc(100vw-256px)] overflow-x-hidden flex flex-col">
                  <div className="md:hidden absolute top-5 left-4 z-20">
                    <button
                      className="p-1 text-ibbiNavy -ml-1 transition hover:bg-black/5 rounded"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                  </div>
                  <Routes>
                    {user?.role !== 'user' && (
                      <>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/members" element={<MemberList />} />
                        <Route path="/communication" element={<CommunicationPanel />} />
                        <Route path="/projeto-amigo" element={<ProjetoAmigoDash />} />
                        <Route path="/grupos" element={<GruposTriagem />} />
                        <Route path="/grupos/:id" element={<GrupoDetalhe />} />
                        <Route path="/ebd" element={<EbdList />} />
                        <Route path="/ebd/:id" element={<EbdChamada />} />
                        <Route path="/ebd/relatorios" element={<EbdRelatorio />} />
                        {user?.role === 'master' && <Route path="/users" element={<UserManagement />} />}
                      </>
                    )}
                    <Route path="/prayer" element={<PrayerRequest />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/carteirinha" element={<UserCarteirinha />} />
                    <Route path="/certificado" element={<UserCertificado />} />
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

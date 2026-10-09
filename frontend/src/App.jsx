import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import useAuth from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import ForceChangePassword from './pages/ForceChangePassword';
import Dashboard from './pages/Dashboard';
import MemberList from './pages/Members/MemberList';
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
import RegistrationApprovals from './pages/RegistrationApprovals';
import CareDashboard from './pages/Care/CareDashboard';
import Assistant from './pages/Assistant';
import TenantSettings from './pages/Settings/TenantSettings';
import Subscription from './pages/Billing/Subscription';
import Pricing from './pages/Pricing';
import Cultos from './pages/Servico/Cultos';
import Escalas from './pages/Servico/Escalas';
import Jornada from './pages/Servico/Jornada';
import Onboarding from './pages/Onboarding';
import DemoEntrar from './pages/Demo/DemoEntrar';
import DemoBanner from './components/DemoBanner';
import Campanhas from './pages/Engajamento/Campanhas';
import Eventos from './pages/Engajamento/Eventos';
import Celulas from './pages/Engajamento/Celulas';
import Impacto from './pages/Engajamento/Impacto';
import { Termos, Privacidade } from './pages/Legal/Legal';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import MemberWhatsApp from './pages/MemberWhatsApp';
import CommunicationHub from './pages/Communication/CommunicationHub';
import EncontrosList from './pages/Encontros/EncontrosList';
import GrupoEncontroPage from './pages/Encontros/GrupoEncontroPage';
import EncontroChamada from './pages/Encontros/EncontroChamada';
import PlatformLogin from './pages/Platform/PlatformLogin';
import PlatformLayout from './pages/Platform/PlatformLayout';
import PlatformDashboard from './pages/Platform/PlatformDashboard';
import PlatformTenants from './pages/Platform/PlatformTenants';
import PlatformTenantDetail from './pages/Platform/PlatformTenantDetail';
import PlatformInvoices from './pages/Platform/PlatformInvoices';
import PlatformPlans from './pages/Platform/PlatformPlans';
import { useTenant } from './context/TenantContext';

export default function App() {
  const { user, logout, mustChangePassword } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded: tenantLoaded, hasFeature } = useTenant();

  return (
    <div className="min-h-screen bg-ibbiCream">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/demo" element={<DemoEntrar />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/login" element={<Login />} />
        <Route path="/external/:token" element={<ExternalMemberForm />} />
        <Route path="/planos" element={<Pricing />} />
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/platform" element={<PlatformLayout />}>
          <Route index element={<PlatformDashboard />} />
          <Route path="igrejas" element={<PlatformTenants />} />
          <Route path="igrejas/:id" element={<PlatformTenantDetail />} />
          <Route path="faturas" element={<PlatformInvoices />} />
          <Route path="planos" element={<PlatformPlans />} />
        </Route>
        <Route path="/force-change-password" element={user ? <ForceChangePassword /> : <Navigate to="/login" replace />} />
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
                  <DemoBanner />
                  {!tenantLoaded ? (
                    <p className="text-sm text-slate-500 pt-16 md:pt-0">Carregando...</p>
                  ) : (
                  <Routes>
                    {['admin', 'master'].includes(user?.role) && (
                      <>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/members" element={<MemberList />} />
                        <Route path="/communication" element={<Navigate to="/whatsapp/central?aba=envios" replace />} />
                        <Route path="/projeto-amigo" element={<ProjetoAmigoDash />} />
                        <Route path="/grupos" element={<GruposTriagem />} />
                        <Route path="/grupos/:id" element={<GrupoDetalhe />} />
                        <Route path="/ebd" element={<EbdList />} />
                        <Route path="/ebd/:id" element={<EbdChamada />} />
                        <Route path="/ebd/relatorios" element={<EbdRelatorio />} />
                        <Route path="/encontros" element={<EncontrosList />} />
                        <Route path="/encontros/grupos/:id" element={<GrupoEncontroPage />} />
                        <Route path="/encontros/:id" element={<EncontroChamada />} />
                        <Route path="/approvals" element={<RegistrationApprovals />} />
                        <Route path="/cuidado" element={<CareDashboard />} />
                        <Route path="/jornada" element={<Jornada />} />
                        <Route path="/cultos" element={<Cultos />} />
                        <Route path="/escalas" element={<Escalas />} />
                        <Route path="/campanhas" element={<Campanhas />} />
                        <Route path="/eventos" element={<Eventos />} />
                        <Route path="/celulas" element={<Celulas />} />
                        <Route path="/impacto" element={<Impacto />} />
                        <Route path="/whatsapp/central" element={<CommunicationHub />} />
                        {hasFeature('agenteWhatsApp') && <Route path="/assistente" element={<Assistant />} />}
                        {user?.role === 'master' && <Route path="/users" element={<UserManagement />} />}
                        {user?.role === 'master' && <Route path="/configuracoes" element={<TenantSettings />} />}
                        {user?.role === 'master' && <Route path="/assinatura" element={<Subscription />} />}
                        {user?.role === 'master' && <Route path="/primeiros-passos" element={<Onboarding />} />}
                      </>
                    )}
                    {user?.role === 'user' && user?.inTriagemGrupo && (
                      <>
                        <Route path="/projeto-amigo" element={<ProjetoAmigoDash />} />
                        <Route path="/grupos" element={<GruposTriagem />} />
                        <Route path="/grupos/:id" element={<GrupoDetalhe />} />
                      </>
                    )}
                    <Route path="/prayer" element={<PrayerRequest />} />
                    <Route path="/whatsapp" element={<MemberWhatsApp />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/carteirinha" element={<UserCarteirinha />} />
                    <Route path="/certificado" element={<UserCertificado />} />
                    <Route path="*" element={<Navigate to={user?.role === 'user' ? '/profile' : '/dashboard'} replace />} />
                  </Routes>
                  )}
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

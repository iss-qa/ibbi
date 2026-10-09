import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import useAuth from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import DemoBanner from './components/DemoBanner';
import { useTenant } from './context/TenantContext';
import TenantLogo from './components/TenantLogo';
import logo from './assets/logo-ibbi.jpeg';

// Cada página vira um pedaço separado do bundle: o app baixa só o que a tela usa.
const Login = lazy(() => import('./pages/Login'));
const ForceChangePassword = lazy(() => import('./pages/ForceChangePassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MemberList = lazy(() => import('./pages/Members/MemberList'));
const PrayerRequest = lazy(() => import('./pages/PrayerRequest'));
const UserManagement = lazy(() => import('./pages/Users/UserManagement'));
const ExternalMemberForm = lazy(() => import('./pages/ExternalMemberForm'));
const EbdList = lazy(() => import('./pages/EBD/EbdList'));
const EbdChamada = lazy(() => import('./pages/EBD/EbdChamada'));
const EbdRelatorio = lazy(() => import('./pages/EBD/EbdRelatorio'));
const Profile = lazy(() => import('./pages/Profile'));
const UserCarteirinha = lazy(() => import('./pages/UserCarteirinha'));
const UserCertificado = lazy(() => import('./pages/UserCertificado'));
const GruposTriagem = lazy(() => import('./pages/GruposTriagem'));
const GrupoDetalhe = lazy(() => import('./pages/GrupoDetalhe'));
const ProjetoAmigoDash = lazy(() => import('./pages/ProjetoAmigoDash'));
const RegistrationApprovals = lazy(() => import('./pages/RegistrationApprovals'));
const CareDashboard = lazy(() => import('./pages/Care/CareDashboard'));
const Assistant = lazy(() => import('./pages/Assistant'));
const TenantSettings = lazy(() => import('./pages/Settings/TenantSettings'));
const Subscription = lazy(() => import('./pages/Billing/Subscription'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Cultos = lazy(() => import('./pages/Servico/Cultos'));
const Escalas = lazy(() => import('./pages/Servico/Escalas'));
const Jornada = lazy(() => import('./pages/Servico/Jornada'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const DemoEntrar = lazy(() => import('./pages/Demo/DemoEntrar'));
const Campanhas = lazy(() => import('./pages/Engajamento/Campanhas'));
const Eventos = lazy(() => import('./pages/Engajamento/Eventos'));
const Celulas = lazy(() => import('./pages/Engajamento/Celulas'));
const Impacto = lazy(() => import('./pages/Engajamento/Impacto'));
const Termos = lazy(() => import('./pages/Legal/Legal').then((m) => ({ default: m.Termos })));
const Privacidade = lazy(() => import('./pages/Legal/Legal').then((m) => ({ default: m.Privacidade })));
const Landing = lazy(() => import('./pages/Landing'));
const Signup = lazy(() => import('./pages/Signup'));
const MemberWhatsApp = lazy(() => import('./pages/MemberWhatsApp'));
const CommunicationHub = lazy(() => import('./pages/Communication/CommunicationHub'));
const EncontrosList = lazy(() => import('./pages/Encontros/EncontrosList'));
const GrupoEncontroPage = lazy(() => import('./pages/Encontros/GrupoEncontroPage'));
const EncontroChamada = lazy(() => import('./pages/Encontros/EncontroChamada'));
const PlatformLogin = lazy(() => import('./pages/Platform/PlatformLogin'));
const PlatformLayout = lazy(() => import('./pages/Platform/PlatformLayout'));
const PlatformDashboard = lazy(() => import('./pages/Platform/PlatformDashboard'));
const PlatformTenants = lazy(() => import('./pages/Platform/PlatformTenants'));
const PlatformTenantDetail = lazy(() => import('./pages/Platform/PlatformTenantDetail'));
const PlatformInvoices = lazy(() => import('./pages/Platform/PlatformInvoices'));
const PlatformPlans = lazy(() => import('./pages/Platform/PlatformPlans'));

function PageFallback() {
  return (
    <div className="animate-pulse space-y-4 pt-2" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-48 rounded-xl bg-slate-200/70" />
      <div className="h-4 w-72 max-w-full rounded-lg bg-slate-200/50" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/70" />)}
      </div>
      <div className="h-64 rounded-2xl bg-white/70" />
    </div>
  );
}

// Igreja suspensa por fatura em atraso: liderança só usa Assinatura (e o perfil); membro vê o aviso.
const LIBERADAS_SUSPENSA = ['/assinatura', '/profile'];
function SuspendedRedirect() {
  const { pathname } = useLocation();
  return LIBERADAS_SUSPENSA.includes(pathname) ? null : <Navigate to="/assinatura" replace />;
}

function SuspendedNotice() {
  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-2xl shadow-soft p-6 text-center" role="alert">
      <p className="font-display text-xl text-ibbiNavy">Acesso temporariamente suspenso</p>
      <p className="text-sm text-slate-600 mt-2">A assinatura da igreja tem uma pendência. Assim que a liderança regularizar, o acesso volta automaticamente.</p>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded: tenantLoaded, hasFeature, tenant } = useTenant();
  const brand = tenant || user?.tenant;

  // Menu aberto no celular: Esc fecha e a página de trás não rola.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-app">
      <Suspense fallback={<div className="min-h-screen" />}>
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
                    className="fixed inset-0 bg-ibbiNavy/40 backdrop-blur-[2px] z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                  />
                )}
                <main className="flex-1 min-w-0 flex flex-col">
                  <div className="md:hidden sticky top-0 z-20 h-14 px-3 flex items-center gap-2 bg-app/85 backdrop-blur-md border-b border-ibbiNavy/5">
                    <button
                      type="button"
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-ibbiNavy transition hover:bg-black/5 active:bg-black/10"
                      onClick={() => setSidebarOpen(true)}
                      aria-label="Abrir menu"
                      aria-expanded={sidebarOpen}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 7h16M4 12h16M4 17h10" /></svg>
                    </button>
                    {brand && <TenantLogo tenant={brand} fallback={logo} className="w-8 h-8" />}
                    <span className="font-display text-ibbiNavy text-lg truncate">{brand?.nomeCurto || brand?.nome || 'PastorIA'}</span>
                  </div>
                  <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 pt-4 pb-10 md:px-8 md:pt-8 lg:px-10">
                  <DemoBanner />
                  {tenantLoaded && tenant?.status === 'suspensa' && ['admin', 'master'].includes(user?.role) && <SuspendedRedirect />}
                  {!tenantLoaded ? (
                    <PageFallback />
                  ) : tenant?.status === 'suspensa' && user?.role === 'user' ? (
                    <SuspendedNotice />
                  ) : (
                  <Suspense fallback={<PageFallback />}>
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
                        <Route path="/assinatura" element={<Subscription />} />
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
                  </Suspense>
                  )}
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
}

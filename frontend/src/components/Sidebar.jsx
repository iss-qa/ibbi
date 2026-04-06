import { Fragment, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import logo from '../assets/logo-ibbi.jpeg';

const iconClass = 'w-[18px] h-[18px] shrink-0';

const navIconMap = {
  '/dashboard': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v4h-6V4zM4 14h6v6H4v-6zm10-2h6v8h-6v-8z" />
    </svg>
  ),
  '/members': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h3v-1.5A3.5 3.5 0 0016.5 15H15m2-6a3 3 0 110-6 3 3 0 010 6zM4 20h11v-1.5A4.5 4.5 0 0010.5 14h-2A4.5 4.5 0 004 18.5V20zm5.5-8A3.5 3.5 0 1010 5a3.5 3.5 0 00-.5 7z" />
    </svg>
  ),
  '/communication': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h7m-9 8l2.4-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h1z" />
    </svg>
  ),
  '/projeto-amigo': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-6-3.6-6-9a3.5 3.5 0 016-2.3A3.5 3.5 0 0118 11c0 5.4-6 9-6 9z" />
    </svg>
  ),
  '/ebd': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h9A1.5 1.5 0 0117.5 6v12A1.5 1.5 0 0116 19.5H7A1.5 1.5 0 015.5 18V6A1.5 1.5 0 017 4.5zm0 0V3m9 1.5V3" />
    </svg>
  ),
  '/prayer': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/profile': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19v-1a3 3 0 00-3-3H8a3 3 0 00-3 3v1m10-10a4 4 0 11-8 0 4 4 0 018 0zm6 10v-1a3 3 0 00-2-2.83" />
    </svg>
  ),
  '/approvals': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/users': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M12 7a4 4 0 11-8 0 4 4 0 018 0zm8 2a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/carteirinha': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h4" />
    </svg>
  ),
  '/certificado': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4v5h5M9 13h6M9 17h4" />
    </svg>
  ),
};

const logoutIcon = (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 16l4-4m0 0l-4-4m4 4H9m4 8v1a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h5a2 2 0 012 2v1" />
  </svg>
);

const navItemsByRole = (role, user) => {
  if (role === 'user') {
    const items = [
      { to: '/profile', label: 'Meu perfil' },
    ];

    // Carteirinha: only for tipo membro
    if (user?.tipo === 'membro') {
      items.push({ to: '/carteirinha', label: 'Carteirinha' });
    }

    // Certificado: only if dataBatismo is set
    if (user?.dataBatismo) {
      items.push({ to: '/certificado', label: 'Certificado' });
    }

    items.push({ to: '/prayer', label: 'Pedido de Oração' });

    return items;
  }

  const items = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/members', label: 'Membros' },
    { to: '/approvals', label: 'Aprovações' },
    { to: '/communication', label: 'Comunicação' },
    { to: '/projeto-amigo', label: 'Projeto Amigo' },
    { to: '/ebd', label: 'EBD' },
    { to: '/prayer', label: 'Pedido de Oração' },
    { to: '/profile', label: 'Meu perfil' },
  ];

  if (role === 'master') {
    items.splice(7, 0, { to: '/users', label: 'Usuários' });
  }

  return items;
};

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Sair do sistema</h3>
        <p className="text-sm text-slate-500 mb-6">Deseja realmente sair do sistema?</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium py-2.5 rounded-xl transition text-sm"
          >
            Não
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition text-sm"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}

// Routes that should highlight "Projeto Amigo" in the sidebar
const PROJETO_AMIGO_ROUTES = ['/projeto-amigo', '/grupos'];

export default function Sidebar({ user, isOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 md:w-64 bg-ibbiNavy text-white min-h-screen px-6 py-8 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 mb-8">
          <img src={logo} alt="IBBI" className="w-12 h-12 rounded-full object-cover border-2 border-ibbiGold" />
          <div>
            <p className="font-display text-lg leading-tight">IBBI</p>
            <p className="text-xs text-ibbiGold">Gestão de Membros</p>
          </div>
        </div>

        <div className="text-sm text-white/70 mb-4">Olá, {user?.nome || 'Visitante'}</div>

        <nav className="flex flex-col gap-2">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Menu</div>
          {navItemsByRole(user?.role, user).map((item) => (
            <Fragment key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => {
                  const forceActive = item.to === '/projeto-amigo' && PROJETO_AMIGO_ROUTES.some((r) => location.pathname.startsWith(r));
                  return `px-3 py-2 rounded-lg transition flex items-center gap-3 ${
                    isActive || forceActive ? 'bg-ibbiGold text-ibbiNavy font-semibold' : 'hover:bg-white/10'
                  }`;
                }}
                onClick={onClose}
              >
                {navIconMap[item.to] || navIconMap['/dashboard']}
                <span>{item.label}</span>
              </NavLink>
              {item.to === '/profile' && (
                <button
                  onClick={() => { setShowLogoutModal(true); onClose(); }}
                  className="px-3 py-2 rounded-lg transition hover:bg-white/10 text-left text-red-300 hover:text-red-200 flex items-center gap-3"
                >
                  {logoutIcon}
                  <span>Sair</span>
                </button>
              )}
            </Fragment>
          ))}
        </nav>
      </aside>

      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
}

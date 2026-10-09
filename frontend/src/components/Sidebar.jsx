import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import logo from '../assets/logo-ibbi.jpeg';
import TenantLogo from './TenantLogo';
import InstalarApp from './InstalarApp';
import { useTenant } from '../context/TenantContext';

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
  '/primeiros-passos': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" /></svg>
  ),
  '/impacto': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" /></svg>
  ),
  '/celulas': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-7 9 7M5 10v9h14v-9M10 19v-5h4v5" /></svg>
  ),
  '/eventos': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8zM14 6v12" /></svg>
  ),
  '/campanhas': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 10v4h3l6 4V6L7 10H4zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /></svg>
  ),
  '/jornada': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-4.35-6-10a6 6 0 1112 0c0 5.65-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
  ),
  '/cultos': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></svg>
  ),
  '/escalas': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17M8 14l2 2 4-4" /></svg>
  ),
  '/cuidado': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l2.5-2 3 3 4-6 3 4 2.5-1.5M5 19h14" />
    </svg>
  ),
  '/assistente': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm6 11l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />
    </svg>
  ),
  '/configuracoes': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M16 4v4M8 10v4m10 2v4" />
    </svg>
  ),
  '/assinatura': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h3" />
    </svg>
  ),
  '/whatsapp': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20l1.3-3.9A8 8 0 1120 12a8 8 0 01-11.8 7L4 20z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.5c.3 1.8 2.7 4.2 4.5 4.5l1-1.2 1.8.8-.3 1.4c-3.6.4-7.5-3.5-7.1-7.1l1.4-.3.8 1.8L9 9.5z" />
    </svg>
  ),
  '/encontros': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h4v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.8M7 20H3v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.1-1.3.4-1.8m0 0a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/whatsapp/central': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20l1.3-3.9A8 8 0 1120 12a8 8 0 01-11.8 7L4 20z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 10.5h7M8.5 13.5h4.5" />
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

const navItemsByRole = (role, user, features = {}, tenant = null) => {
  if (role === 'user') {
    const items = [
      { to: '/profile', label: 'Meu perfil' },
      { to: '/whatsapp', label: 'Meu WhatsApp' },
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

    if (user?.inTriagemGrupo) {
      items.push({ to: '/projeto-amigo', label: 'Projeto Amigo' });
    }

    return items;
  }

  // Liderança (admin/master): itens soltos no topo + seções que abrem e fecham.
  const sections = [
    { key: 'pessoas', label: 'Pessoas', icon: '/members', items: [
      { to: '/members', label: 'Pessoas' },
      { to: '/approvals', label: 'Aprovações' },
      ...(features.jornadaVisitante ? [{ to: '/jornada', label: 'Jornada do Visitante' }] : []),
      { to: '/projeto-amigo', label: 'Projeto Amigo' },
    ] },
    { key: 'cuidado', label: 'Cuidado pastoral', icon: '/projeto-amigo', items: [
      { to: '/cuidado', label: 'Cuidado Pastoral' },
      { to: '/prayer', label: 'Pedidos de Oração' },
      { to: '/impacto', label: 'Impacto do mês' },
    ] },
    { key: 'reunioes', label: 'Cultos e reuniões', icon: '/encontros', items: [
      { to: '/cultos', label: 'Cultos (QR)' },
      { to: '/ebd', label: 'EBD' },
      { to: '/encontros', label: 'Encontros' },
      { to: '/celulas', label: 'Células' },
      { to: '/escalas', label: 'Escalas' },
    ] },
    { key: 'comunicacao', label: 'Comunicação', icon: '/communication', items: [
      { to: '/whatsapp/central', label: 'Central WhatsApp' },
      { to: '/campanhas', label: 'Campanhas' },
      { to: '/eventos', label: 'Eventos' },
      ...(features.agenteWhatsApp ? [{ to: '/assistente', label: 'Assistente IA' }] : []),
    ] },
    ...(role === 'master' ? [{ key: 'admin', label: 'Administração', icon: '/configuracoes', items: [
      { to: '/users', label: 'Usuários' },
      { to: '/configuracoes', label: 'Configurações' },
      { to: '/assinatura', label: 'Assinatura' },
    ] }] : []),
  ];

  return [
    ...(role === 'master' && !tenant?.onboarding?.concluido ? [{ to: '/primeiros-passos', label: 'Primeiros passos 🌱' }] : []),
    { to: '/dashboard', label: 'Dashboard' },
    ...sections.filter((s) => s.items.length),
  ];
};

const chevronIcon = (open) => (
  <svg className={`w-4 h-4 ml-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
  </svg>
);

// Seções abertas ficam lembradas no navegador (conveniência; sem storage, tudo começa fechado).
const OPEN_KEY = 'sidebar:open';
const readOpen = () => {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY)) || []; } catch { return []; }
};
const saveOpen = (keys) => {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(keys)); } catch { /* sem storage */ }
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

// Item ativo também nas subpáginas (/ebd/:id, /encontros/grupos/:id…).
const matchesRoute = (to, pathname) => {
  if (to === '/projeto-amigo') return PROJETO_AMIGO_ROUTES.some((r) => pathname.startsWith(r));
  return pathname === to || pathname.startsWith(`${to}/`);
};

const itemClass = (active, nested) => `px-3 ${nested ? 'py-1.5 text-[15px]' : 'py-2'} rounded-xl transition flex items-center gap-3 min-w-0 ${
  active ? 'bg-ibbiGold text-ibbiNavy font-semibold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
}`;

export default function Sidebar({ user, isOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openKeys, setOpenKeys] = useState(readOpen);
  const { tenant, features } = useTenant();
  const brand = tenant || user?.tenant;
  const entries = navItemsByRole(user?.role, user, features, brand);
  const isActive = (to) => matchesRoute(to, location.pathname);
  const activeSection = entries.find((e) => e.items?.some((i) => isActive(i.to)))?.key;

  // Abre sozinha a seção da página atual (ao navegar por link, busca, dashboard…).
  useEffect(() => {
    if (!activeSection) return;
    setOpenKeys((keys) => {
      if (keys.includes(activeSection)) return keys;
      const next = [...keys, activeSection];
      saveOpen(next);
      return next;
    });
  }, [activeSection]);

  const toggleSection = (key) => {
    setOpenKeys((keys) => {
      const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
      saveOpen(next);
      return next;
    });
  };

  const renderItem = (item, nested = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={() => itemClass(isActive(item.to), nested)}
      onClick={onClose}
    >
      {navIconMap[item.to] || navIconMap['/dashboard']}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <aside
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-40 w-[min(18rem,85vw)] rounded-r-3xl md:rounded-3xl bg-ibbiNavy text-white flex flex-col shadow-2xl md:shadow-soft transform transition-transform duration-200 ease-out md:sticky md:top-3 md:m-3 md:mr-0 md:w-64 md:h-[calc(100dvh-1.5rem)] md:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 pt-6 pb-4 flex items-center gap-3">
          <TenantLogo tenant={brand} fallback={logo} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight truncate" title={brand?.nome}>{brand?.nomeCurto || 'Igreja'}</p>
            <p className="text-xs text-ibbiGold truncate">Olá, {user?.nome?.split(' ')[0] || 'Visitante'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-3 flex flex-col gap-1">
          <div className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Menu</div>
          {entries.map((entry) => {
            if (!entry.items) return renderItem(entry);
            const open = openKeys.includes(entry.key);
            const hasActive = entry.key === activeSection;
            return (
              <div key={entry.key}>
                <button
                  type="button"
                  onClick={() => toggleSection(entry.key)}
                  aria-expanded={open}
                  aria-controls={`nav-${entry.key}`}
                  className={`w-full px-3 py-2 rounded-xl transition flex items-center gap-3 text-left hover:bg-white/10 ${
                    hasActive && !open ? 'text-ibbiGold font-semibold' : ''
                  }`}
                >
                  {navIconMap[entry.icon]}
                  <span className="truncate">{entry.label}</span>
                  {chevronIcon(open)}
                </button>
                {open && (
                  <div id={`nav-${entry.key}`} className="mt-1 mb-1 ml-[18px] pl-3 border-l border-white/10 flex flex-col gap-0.5">
                    {entry.items.map((item) => renderItem(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 pt-3 border-t border-white/10 flex flex-col gap-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {user?.role !== 'user' && renderItem({ to: '/profile', label: 'Meu perfil' })}
          <InstalarApp />
          <button
            type="button"
            onClick={() => { setShowLogoutModal(true); onClose(); }}
            className="px-3 py-2 rounded-xl transition hover:bg-white/10 text-left text-red-300 hover:text-red-200 flex items-center gap-3"
          >
            {logoutIcon}
            <span>Sair</span>
          </button>
        </div>
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

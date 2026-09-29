import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import platformApi, { PLATFORM_TOKEN_KEY } from '../../services/platformApi';

const NAV = [
  { to: '/platform', label: 'Dashboard', end: true },
  { to: '/platform/igrejas', label: 'Igrejas' },
  { to: '/platform/faturas', label: 'Faturas' },
  { to: '/platform/planos', label: 'Planos' },
];

export default function PlatformLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem(PLATFORM_TOKEN_KEY);

  useEffect(() => {
    if (token) platformApi.get('/auth/me').then((r) => setAdmin(r.data.admin)).catch(() => {});
  }, [token]);

  if (!token) return <Navigate to="/platform/login" replace />;

  const logout = () => {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    navigate('/platform/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-60 bg-slate-900 text-white px-5 py-8 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-ibbiGold">Plataforma</p>
        <p className="font-display text-lg mb-1">Gestão multi-tenant</p>
        <p className="text-xs text-white/50 mb-8 truncate">{admin?.email}</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-ibbiGold text-ibbiNavy font-semibold' : 'hover:bg-white/10'}`}>
              {n.label}
            </NavLink>
          ))}
          <button type="button" onClick={logout} className="px-3 py-2 rounded-lg text-sm text-left text-red-300 hover:bg-white/10 mt-4">Sair</button>
        </nav>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <button type="button" className="md:hidden mb-3 text-slate-700" onClick={() => setOpen(true)} aria-label="Abrir menu">☰ Menu</button>
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import logo from '../assets/logo-ibbi.jpeg';

const navItemsByRole = (role) => {
  if (role === 'user') {
    return [
      { to: '/profile', label: 'Meu perfil' },
      { to: '/prayer', label: 'Pedido de Oração' },
    ];
  }
  const items = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/members', label: 'Membros' },
    { to: '/communication', label: 'Comunicação' },
    { to: '/ebd', label: 'EBD' },
    { to: '/prayer', label: 'Pedido de Oração' },
    { to: '/profile', label: 'Meu perfil' },
  ];

  if (role === 'master') {
    items.splice(5, 0, { to: '/users', label: 'Usuários' });
  }

  return items;
};

export default function Sidebar({ user, isOpen, onClose }) {
  return (
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
        {navItemsByRole(user?.role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg transition ${
                isActive ? 'bg-ibbiGold text-ibbiNavy font-semibold' : 'hover:bg-white/10'
              }`
            }
            onClick={onClose}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

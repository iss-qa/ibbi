import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/landing/Logo';

const LINKS = [
  ['#como-funciona', 'Como funciona'],
  ['#recursos', 'Recursos'],
  ['#planos', 'Planos'],
  ['#faq', 'Dúvidas'],
];

export default function Nav({ user }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primary = user
    ? { to: '/dashboard', label: 'Ir para o painel' }
    : { to: '/cadastro', label: 'Começar grátis' };

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled || open ? 'bg-brandNavy/90 backdrop-blur-md shadow-lg shadow-black/10' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label="PastorIA — início" onClick={() => setOpen(false)}>
          <Logo light />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-white/80">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-white transition">{label}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {!user && <Link to="/login" className="text-sm text-white/80 hover:text-white transition">Entrar</Link>}
          <Link to={primary.to} className="text-sm font-semibold bg-brandGold text-brandNavy px-4 py-2 rounded-full hover:brightness-95 transition shadow-md shadow-brandGold/20">
            {primary.label}
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden p-2 text-white"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 px-4 pb-5 pt-2 space-y-1 text-white/90">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2.5">{label}</a>
          ))}
          {!user && <Link to="/login" onClick={() => setOpen(false)} className="block py-2.5">Entrar</Link>}
          <Link to={primary.to} onClick={() => setOpen(false)} className="block text-center mt-2 font-semibold bg-brandGold text-brandNavy px-4 py-2.5 rounded-full">
            {primary.label}
          </Link>
        </div>
      )}
    </header>
  );
}

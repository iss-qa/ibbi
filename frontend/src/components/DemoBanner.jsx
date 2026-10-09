import { useEffect, useState } from 'react';
import { useTenant } from '../context/TenantContext';
import useAuth from '../hooks/useAuth';

// Faixa da igreja demonstração: lembra que é somente leitura e leva ao cadastro.
export default function DemoBanner() {
  const { tenant } = useTenant();
  const { logout } = useAuth();
  const [alerta, setAlerta] = useState(false);
  useEffect(() => {
    const on = () => { setAlerta(true); setTimeout(() => setAlerta(false), 4000); };
    window.addEventListener('demo-readonly', on);
    return () => window.removeEventListener('demo-readonly', on);
  }, []);
  if (!tenant?.demo) return null;
  const cadastrar = () => { logout(); window.location.href = '/cadastro'; };
  return (
    <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2 transition ${alerta ? 'bg-amber-500 text-white' : 'bg-ibbiNavy text-white'}`} role="status">
      <span>{alerta ? '🔒 Esta é a igreja demonstração: não é possível alterar dados.' : '👀 Você está na igreja demonstração (dados fictícios, somente leitura).'}</span>
      <button type="button" onClick={cadastrar} className="px-3 py-1 rounded-full bg-ibbiGold text-ibbiNavy font-semibold text-xs">Cadastrar minha igreja: 14 dias grátis</button>
    </div>
  );
}

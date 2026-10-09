import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import Logo from '../../components/landing/Logo';

// /demo: abre a igreja demonstração (dados fictícios, somente leitura) sem cadastro.
export default function DemoEntrar() {
  const [erro, setErro] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post('/public/demo');
        const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${data.token}` } });
        localStorage.setItem('ibbi_token', data.token);
        localStorage.setItem('ibbi_user', JSON.stringify(me.data.user || me.data));
        localStorage.setItem('ibbi_tenant', data.igreja);
        localStorage.removeItem('ibbi_mustChangePassword');
        window.location.replace('/dashboard');
      } catch (e) {
        setErro(e.response?.data?.message || 'Não foi possível abrir a demonstração agora.');
      }
    })();
  }, []);
  return (
    <div className="min-h-screen bg-brandNavy text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo light size="lg" />
      {erro ? (
        <>
          <p className="text-white/80">{erro}</p>
          <Link to="/cadastro" className="px-5 py-2.5 rounded-full bg-brandGold text-brandNavy font-semibold">Criar minha igreja grátis</Link>
        </>
      ) : <p className="text-white/80">Preparando a igreja demonstração…</p>}
    </div>
  );
}

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import platformApi, { PLATFORM_TOKEN_KEY } from '../../services/platformApi';
import DevQuickLogin from '../../components/DevQuickLogin';

export default function PlatformLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || '', senha: location.state?.senha || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.post('/auth/login', form);
      localStorage.setItem(PLATFORM_TOKEN_KEY, data.token);
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  const onDevPick = (key, cred) => {
    if (key === 'plataforma') setForm({ email: cred.email || '', senha: cred.senha || '' });
    else navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-ibbiGold">Plataforma</p>
        <h1 className="font-display text-2xl text-ibbiNavy mt-1">Gestão multi-tenant</h1>
        <p className="text-sm text-slate-500 mb-6">Igrejas parceiras, assinaturas e métricas</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Email</span>
            <input type="email" required className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ibbiBlue" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Senha</span>
            <input type="password" required className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ibbiBlue" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-ibbiNavy text-white rounded-lg py-2 font-semibold hover:bg-slate-800 transition">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <DevQuickLogin onPick={onDevPick} />
      </div>
    </div>
  );
}

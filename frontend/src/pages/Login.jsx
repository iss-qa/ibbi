import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo-ibbi.jpeg';
import useAuth from '../hooks/useAuth';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};
  const [form, setForm] = useState({ login: prefill.login || '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(!RECAPTCHA_SITE_KEY);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    // Carregar script do reCAPTCHA v3
    if (document.querySelector(`script[src*="recaptcha"]`)) {
      setRecaptchaReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => setRecaptchaReady(true);
    document.head.appendChild(script);
  }, []);

  const getRecaptchaToken = useCallback(async () => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return null;
    try {
      return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' });
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const recaptchaToken = await getRecaptchaToken();
      const data = await login(form.login, form.senha, recaptchaToken);
      if (data.mustChangePassword) {
        navigate('/force-change-password', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const errData = err?.response?.data;
      const debugInfo = errData?.debug ? ` [${JSON.stringify(errData.debug)}]` : '';
      setError((errData?.message || 'Falha no login') + debugInfo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ibbiNavy via-ibbiBlue to-ibbiNavy flex items-center justify-center px-6">
      <div className="bg-white shadow-soft rounded-2xl max-w-md w-full p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={logo} alt="IBBI" className="w-16 h-16 rounded-full object-cover border-2 border-ibbiGold" />
          <h1 className="font-display text-2xl text-ibbiNavy">Bem-vindo à IBBI</h1>
          <p className="text-sm text-slate-500">Acesse o sistema de gestão de membros</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Login</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              placeholder="seu login"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Senha</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-11 focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="sua senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-slate-500"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !recaptchaReady}
            className="w-full bg-ibbiBlue text-white rounded-lg py-2 font-semibold hover:bg-ibbiNavy transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

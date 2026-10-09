import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import TenantLogo from '../components/TenantLogo';
import DevQuickLogin from '../components/DevQuickLogin';
import Logo from '../components/landing/Logo';

const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT || 'ibbi';

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
  const [igreja, setIgreja] = useState(() => new URLSearchParams(location.search).get('igreja')
    || localStorage.getItem('ibbi_tenant') || DEFAULT_TENANT);
  const [editIgreja, setEditIgreja] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantError, setTenantError] = useState('');

  // Identidade visual da igreja (nome/logo) antes do login
  useEffect(() => {
    if (!igreja || editIgreja) return undefined;
    let active = true;
    api.get(`/public/tenants/${encodeURIComponent(igreja.trim().toLowerCase())}`)
      .then(({ data }) => { if (active) { setTenantInfo(data); setTenantError(''); } })
      .catch(() => { if (active) { setTenantInfo(null); setTenantError('Igreja não encontrada. Confira o código.'); } });
    return () => { active = false; };
  }, [igreja, editIgreja]);

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

  const getRecaptchaToken = useCallback(() => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return Promise.resolve(null);
    return new Promise((resolve) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' });
          resolve(token);
        } catch {
          resolve(null);
        }
      });
    });
  }, []);

  // Atalhos locais: membro/admin preenchem este formulário; o master vai para o painel da plataforma.
  const handleDevPick = (key, cred) => {
    if (key === 'plataforma') {
      navigate('/platform/login', { state: { email: cred.email, senha: cred.senha } });
      return;
    }
    setForm({ login: cred.login || '', senha: cred.senha || '' });
    if (cred.igreja) {
      setIgreja(cred.igreja);
      setEditIgreja(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const recaptchaToken = await getRecaptchaToken();
      const data = await login(form.login, form.senha, recaptchaToken, igreja.trim().toLowerCase());
      if (data.mustChangePassword) {
        navigate('/force-change-password', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ibbiNavy via-ibbiBlue to-ibbiNavy flex items-center justify-center px-6">
      <div className="bg-white shadow-soft rounded-2xl max-w-md w-full p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <a href="/" aria-label="PastorIA — início"><Logo size="lg" /></a>
          <p className="font-display text-ibbiGold text-sm">Quem falta, faz falta.</p>
          <h1 className="font-display text-xl text-ibbiNavy text-center mt-2">Bem-vindo à {tenantInfo?.nomeCurto || 'sua igreja'}</h1>
        </div>

        <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
          {editIgreja ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                className="flex-1 min-w-0 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
                value={igreja}
                onChange={(e) => setIgreja(e.target.value)}
                placeholder="código da igreja (ex.: ibbi)"
              />
              <button type="button" className="text-ibbiBlue font-medium" onClick={() => setEditIgreja(false)}>OK</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-slate-600 truncate">
                {tenantInfo && <TenantLogo tenant={tenantInfo} className="w-7 h-7" />}
                <span className="truncate">Igreja: <strong className="text-slate-800">{tenantInfo?.nome || igreja}</strong></span>
              </span>
              <button type="button" className="text-ibbiBlue font-medium shrink-0" onClick={() => setEditIgreja(true)}>trocar</button>
            </div>
          )}
          {tenantError && !editIgreja && <p className="text-xs text-red-600 mt-1">{tenantError}</p>}
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
          {/* Operador da plataforma entra com email, em outra tela */}
          {error && form.login.includes('@') && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              Este login é da igreja (ex.: <strong>joao</strong>). Administrador da plataforma?{' '}
              <a href="/platform/login" className="text-ibbiBlue font-medium hover:underline">Entre por aqui</a>.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !recaptchaReady}
            className="w-full bg-ibbiBlue text-white rounded-lg py-2 font-semibold hover:bg-ibbiNavy transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Sua igreja ainda não usa o PastorIA? <a href="/cadastro" className="text-ibbiBlue font-medium">Cadastre grátis</a>
        </p>

        <DevQuickLogin onPick={handleDevPick} />
      </div>
    </div>
  );
}

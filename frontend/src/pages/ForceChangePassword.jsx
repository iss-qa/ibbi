import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import logo from '../assets/logo-ibbi.jpeg';

export default function ForceChangePassword() {
  const { user, logout, completePasswordChange } = useAuth();
  const navigate = useNavigate();
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (senhaNova.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (senhaNova !== confirmar) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      await api.put('/users/me/password', { senhaNova });
      completePasswordChange();
      navigate(user?.role === 'user' ? '/profile' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ibbiNavy via-ibbiBlue to-ibbiNavy flex items-center justify-center px-6">
      <div className="bg-white shadow-soft rounded-2xl max-w-md w-full p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={logo} alt="IBBI" className="w-16 h-16 rounded-full object-cover border-2 border-ibbiGold" />
          <h1 className="font-display text-2xl text-ibbiNavy">Troca de Senha</h1>
          <p className="text-sm text-slate-500 text-center">
            Para sua segurança, é necessário criar uma nova senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Nova Senha</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-11 focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                placeholder="mínimo 6 caracteres"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 flex items-center text-slate-500"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Confirmar Nova Senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="repita a nova senha"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ibbiBlue text-white rounded-lg py-2 font-semibold hover:bg-ibbiNavy transition"
          >
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

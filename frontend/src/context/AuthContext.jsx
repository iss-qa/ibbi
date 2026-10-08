import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ibbi_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null; // valor corrompido não pode derrubar o app inteiro
    }
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return localStorage.getItem('ibbi_mustChangePassword') === 'true';
  });

  const login = async (loginInput, senha, recaptchaToken, igreja) => {
    const payload = { login: loginInput, senha };
    if (igreja) payload.igreja = igreja;
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
    const { data } = await api.post('/auth/login', payload);
    localStorage.setItem('ibbi_token', data.token);
    localStorage.setItem('ibbi_user', JSON.stringify(data.user));
    if (data.user?.tenant?.slug) localStorage.setItem('ibbi_tenant', data.user.tenant.slug);
    setUser(data.user);
    if (data.mustChangePassword) {
      localStorage.setItem('ibbi_mustChangePassword', 'true');
      setMustChangePassword(true);
    } else {
      localStorage.removeItem('ibbi_mustChangePassword');
      setMustChangePassword(false);
    }
    return data;
  };

  const completePasswordChange = () => {
    localStorage.removeItem('ibbi_mustChangePassword');
    setMustChangePassword(false);
  };

  const logout = () => {
    localStorage.removeItem('ibbi_token');
    localStorage.removeItem('ibbi_user');
    localStorage.removeItem('ibbi_mustChangePassword');
    setUser(null);
    setMustChangePassword(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('ibbi_token');
    if (!token) return;

    let active = true;
    api.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        localStorage.setItem('ibbi_user', JSON.stringify(data.user));
        setUser(data.user);
        if (data.mustChangePassword) {
          localStorage.setItem('ibbi_mustChangePassword', 'true');
          setMustChangePassword(true);
        } else {
          localStorage.removeItem('ibbi_mustChangePassword');
          setMustChangePassword(false);
        }
      })
      .catch((err) => {
        // Só encerra a sessão se o token for recusado; queda de rede, 5xx ou 402
        // (igreja suspensa, master precisa chegar em /assinatura) mantêm o login.
        const status = err?.response?.status;
        if (!active || (status !== 401 && status !== 403)) return;
        logout();
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  const value = useMemo(() => ({ user, login, logout, mustChangePassword, completePasswordChange }), [user, mustChangePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}

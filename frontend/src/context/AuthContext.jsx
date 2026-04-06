import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ibbi_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return localStorage.getItem('ibbi_mustChangePassword') === 'true';
  });

  const login = async (loginInput, senha, recaptchaToken) => {
    const payload = { login: loginInput, senha };
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
    const { data } = await api.post('/auth/login', payload);
    localStorage.setItem('ibbi_token', data.token);
    localStorage.setItem('ibbi_user', JSON.stringify(data.user));
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
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('ibbi_token');
        localStorage.removeItem('ibbi_user');
        localStorage.removeItem('ibbi_mustChangePassword');
        setUser(null);
        setMustChangePassword(false);
      });

    return () => {
      active = false;
    };
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

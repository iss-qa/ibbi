import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ibbi_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (login, senha) => {
    const { data } = await api.post('/auth/login', { login, senha });
    localStorage.setItem('ibbi_token', data.token);
    localStorage.setItem('ibbi_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('ibbi_token');
    localStorage.removeItem('ibbi_user');
    setUser(null);
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
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('ibbi_token');
        localStorage.removeItem('ibbi_user');
        setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}

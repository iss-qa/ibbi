import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { setCongregacoes } from '../constants/congregacoes';

const TenantContext = createContext(null);

// Fundo das telas internas escolhido pela igreja (#rrggbb → "r g b" para o token `app` do Tailwind).
const applyCorFundo = (hex) => {
  const root = document.documentElement;
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) { root.style.removeProperty('--app-bg-rgb'); return; }
  const n = parseInt(m[1], 16);
  root.style.setProperty('--app-bg-rgb', `${n >> 16} ${(n >> 8) & 255} ${n & 255}`);
};

// Dados da igreja logada: marca, congregações, plano/recursos e consumo.
export function TenantProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(() => user?.tenant || null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/tenant');
      setCongregacoes(data.congregacoes);
      setTenant(data);
    } catch {
      // mantém o que veio no login
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setTenant(null);
      setLoaded(true);
      return;
    }
    if (user.tenant?.congregacoes) setCongregacoes(user.tenant.congregacoes);
    setLoaded(false);
    refresh();
  }, [user?._id, refresh]);

  useEffect(() => { applyCorFundo(tenant?.branding?.corFundo); }, [tenant?.branding?.corFundo]);

  useEffect(() => {
    const onSuspended = () => navigate('/assinatura', { replace: true });
    window.addEventListener('tenant-suspended', onSuspended);
    return () => window.removeEventListener('tenant-suspended', onSuspended);
  }, [navigate]);

  const value = useMemo(() => ({
    tenant,
    loaded,
    refresh,
    previewCorFundo: applyCorFundo,
    features: tenant?.planoInfo?.features || {},
    hasFeature: (f) => Boolean(tenant?.planoInfo?.features?.[f]),
  }), [tenant, loaded, refresh]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant deve ser usado dentro de TenantProvider');
  return ctx;
}

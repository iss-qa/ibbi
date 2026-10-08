import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ibbi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Igreja suspensa por inadimplência: leva o master para a tela de assinatura.
// Sessão expirada/inválida (401): avisa o AuthContext para encerrar a sessão.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    if (error?.response?.status === 402 && error.response.data?.code === 'TENANT_SUSPENDED') {
      if (!window.location.pathname.startsWith('/assinatura')) {
        window.dispatchEvent(new CustomEvent('tenant-suspended', { detail: error.response.data.message }));
      }
    }
    return Promise.reject(error);
  },
);

export default api;

import axios from 'axios';

// Cliente do painel da plataforma (operadores do SaaS). Token separado do login da igreja.
export const PLATFORM_TOKEN_KEY = 'platform_token';

const platformApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')}/platform`,
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && !String(error.config?.url).includes('/auth/login')) {
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      if (!window.location.pathname.startsWith('/platform/login')) window.location.assign('/platform/login');
    }
    return Promise.reject(error);
  },
);

export default platformApi;

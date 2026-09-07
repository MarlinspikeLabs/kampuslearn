import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

function isAccountRequest(config) {
  const path = String(config?.url || '').split('?')[0];
  return /\/auth\/(login|register)\/?$/.test(path);
}

api.interceptors.request.use((config) => {
  // Credentials on login/register are handled by those endpoints; an old JWT
  // must not turn an incorrect password into an expired-session redirect.
  if (typeof window !== 'undefined' && !isAccountRequest(config)) {
    const token = localStorage.getItem('kl_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isAccountRequest(err.config) && typeof window !== 'undefined') {
      const sentToken = err.config?.headers?.Authorization;
      const currentToken = localStorage.getItem('kl_token');
      // A response from an earlier session must not erase a newer login.
      if (!sentToken || sentToken === `Bearer ${currentToken}`) {
        localStorage.removeItem('kl_token');
        localStorage.removeItem('kl_user');
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

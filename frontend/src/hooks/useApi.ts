import { useAuth } from './useAuth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const useApi = () => {
  const { token, logout } = useAuth();

  const request = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (options.body instanceof FormData) delete headers['Content-Type'];
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) { logout(); window.location.href = '/login'; throw new Error('Session expirée'); }
    if (!res.ok) throw new Error(data.message || 'Erreur serveur');
    return data;
  };

  return {
    get: (ep: string) => request(ep),
    post: (ep: string, body: any) => request(ep, { method: 'POST', body: JSON.stringify(body) }),
    put: (ep: string, body: any) => request(ep, { method: 'PUT', body: JSON.stringify(body) }),
    del: (ep: string) => request(ep, { method: 'DELETE' }),
    upload: (ep: string, fd: FormData) => request(ep, { method: 'POST', body: fd }),
  };
};
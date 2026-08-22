import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

export default function AuthCallback() {
  const { setAuth } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      navigate('/login?error=google');
      return;
    }

    (async () => {
      try {
        const data = await api.post('/auth/google/exchange', { code });
        setAuth(data.token, data.user);
        navigate('/');
      } catch {
        navigate('/login?error=google');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Connexion en cours...</p>
      </div>
    </div>
  );
}
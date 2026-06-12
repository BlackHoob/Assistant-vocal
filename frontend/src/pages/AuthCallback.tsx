import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthCallback() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const name  = params.get('name')  || '';
    const email = params.get('email') || '';
    const id    = parseInt(params.get('id') || '0');
    const error = params.get('error');

    if (error || !token) {
      navigate('/login?error=google');
      return;
    }

    setAuth(token, { id, name, email });
    navigate('/');
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
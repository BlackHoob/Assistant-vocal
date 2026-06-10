import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMe, getJWT } from '../lib/appwrite';
import { Mic } from 'lucide-react';

export default function AuthCallback() {
  const { setUser, setJwt } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const user = await getMe();
        if (user) {
          const jwt = await getJWT();
          setUser(user as any);
          setJwt(jwt);
          navigate('/');
        } else {
          navigate('/login');
        }
      } catch {
        navigate('/login');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-3xl bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30 animate-pulse">
          <Mic size={28} className="text-white" />
        </div>
        <p className="text-sm text-gray-400">Connexion en cours...</p>
      </div>
    </div>
  );
}

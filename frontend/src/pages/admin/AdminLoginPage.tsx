import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Mic, Eye, EyeOff, Shield } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Identifiants invalides');
      setAdmin(data.token, data.admin);
      navigate('/admin');
    } catch {
      setError('Erreur de connexion au serveur');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-500/30">
            <Mic size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nestor Vocal</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1.5">
            <Shield size={13} /> Espace administration
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-base font-semibold text-white mb-6">Connexion administrateur</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Nom d'utilisateur ou email
              </label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors"
                placeholder="admin" autoComplete="username" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors pr-10"
                  placeholder="••••••••" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 text-white text-sm font-medium py-3 rounded-xl hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : 'Se connecter'}
            </button>
          </form>

          <p className="text-xs text-gray-700 text-center mt-5">
            Accès restreint — JWT + bcrypt
          </p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          Identifiants par défaut : <span className="text-gray-500">admin / Admin123!</span>
        </p>
      </div>
    </div>
  );
}
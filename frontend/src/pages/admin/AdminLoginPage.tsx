import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-white flex font-sans">
      {/* Panneau gauche */}
      <div className="hidden lg:flex w-1/2 bg-orange-500 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/8" />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-8 shadow-xl">
            <Shield size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Nestor Vocal</h2>
          <p className="text-orange-100 text-sm leading-relaxed max-w-xs">
            Espace administration sécurisé. Gérez les utilisateurs, rendez-vous et données.
          </p>
        </div>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center">
              <Mic size={20} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Nestor Vocal</span>
          </div>

          {/* ── SWITCH EN HAUT ── */}
          <div className="flex rounded-2xl border border-gray-200 p-1 mb-8 bg-gray-50">
            <Link to="/login"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
               Client
            </Link>
            <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white shadow-sm border border-gray-100 text-sm font-semibold text-orange-500">
               Admin
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Administration </h1>
          <p className="text-sm text-gray-400 mb-6">Connectez-vous à l'espace administrateur</p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Nom d'utilisateur ou email
              </label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="input-field" placeholder="admin" autoComplete="username" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className="input-field pr-10" placeholder="••••••••" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Se connecter'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
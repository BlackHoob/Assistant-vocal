import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mic, Eye, EyeOff } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setAuth(data.token, data.user);
      navigate('/');
    } catch { setError('Erreur de connexion'); }
    finally { setLoading(false); }
  };

  const handleGoogle = () => {
    window.location.href = `${API}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Panneau gauche */}
      <div className="hidden lg:flex w-1/2 bg-orange-500 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/8" />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-8 shadow-xl">
            <Mic size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Nestor Vocal</h2>
          <p className="text-orange-100 text-sm leading-relaxed max-w-xs">
            Votre assistant concierge personnel. Gérez vos voyages, rendez-vous et documents.
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
            <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white shadow-sm border border-gray-100 text-sm font-semibold text-orange-500">
               Client
            </div>
            <Link to="/admin/login"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
              Admin
            </Link>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Bon retour</h1>
          <p className="text-sm text-gray-400 mb-6">Connectez-vous à votre espace</p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="input-field" placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className="input-field pr-10" placeholder="••••••••" />
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

          <p className="text-center text-xs text-gray-400 mt-4">
            Pas de compte ?{' '}
            <Link to="/register" className="text-orange-500 font-medium hover:underline">S'inscrire</Link>
          </p>

          {/* ── GOOGLE EN BAS ── */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <button onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
              <GoogleIcon />
              Continuer avec Google
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
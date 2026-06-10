import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mic, Eye, EyeOff } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Mot de passe min. 8 caractères');
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setAuth(data.token, data.user);
      navigate('/');
    } catch { setError('Erreur de connexion'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white flex font-sans">
      <div className="hidden lg:flex w-1/2 bg-orange-500 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600" />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-8 shadow-xl">
            <Mic size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Rejoignez Nestor</h2>
          <p className="text-orange-100 text-sm max-w-xs">Créez votre compte et accédez à votre assistant vocal personnel.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Créer un compte</h1>
          <p className="text-sm text-gray-400 mb-8">Votre assistant vous attend</p>

          {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Nom complet</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="input-field" placeholder="Jean Dupont" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="input-field" placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="input-field pr-10" placeholder="Min. 8 caractères" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-orange-500 font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return setError('Lien invalide ou expiré. Refaites une demande de réinitialisation.');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');
    if (password.length < 8) return setError('Minimum 8 caractères');

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Lien invalide ou expiré');
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white flex font-sans">
      <div className="hidden lg:flex w-1/2 bg-orange-500 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/8" />
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-8 shadow-xl">
            <Mic size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Nestor Vocal</h2>
          <p className="text-orange-100 text-sm leading-relaxed max-w-xs">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">

          {done ? (
            <div>
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
                <CheckCircle size={26} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Mot de passe mis à jour</h1>
              <p className="text-sm text-gray-500">Redirection vers la connexion...</p>
            </div>
          ) : !token ? (
            <div>
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Lien invalide</h1>
              <p className="text-sm text-gray-500 mb-5">
                Ce lien de réinitialisation est manquant ou incorrect. Refaites une demande.
              </p>
              <Link to="/forgot-password" className="text-orange-500 font-medium text-sm hover:underline">
                Retour à la demande de réinitialisation
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Nouveau mot de passe</h1>
              <p className="text-sm text-gray-400 mb-6">Choisissez un mot de passe d'au moins 8 caractères.</p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} required
                      className="input-field pr-10" placeholder="••••••••" autoFocus />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Confirmer le mot de passe</label>
                  <input type={showPwd ? 'text' : 'password'} value={confirm}
                    onChange={e => setConfirm(e.target.value)} required
                    className="input-field" placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
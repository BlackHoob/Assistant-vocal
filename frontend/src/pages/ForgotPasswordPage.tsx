import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // On affiche toujours le même message de succès, que l'email existe ou
      // non en base — c'est volontaire, pour ne pas permettre à quelqu'un de
      // deviner quels emails sont inscrits (énumération de comptes).
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Une erreur est survenue');
      }
      setSent(true);
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
            Récupérez l'accès à votre compte en toute sécurité.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>

          {sent ? (
            <div>
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
                <CheckCircle size={26} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Vérifiez vos e-mails</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Si un compte existe avec l'adresse <span className="font-medium text-gray-700">{email}</span>,
                un e-mail contenant un lien de réinitialisation vient de vous être envoyé. Le lien est valable 1 heure.
              </p>
              <button onClick={() => setSent(false)} className="mt-5 text-sm text-orange-500 font-medium hover:underline">
                Renvoyer l'e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-5">
                <Mail size={22} className="text-orange-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Mot de passe oublié ?</h1>
              <p className="text-sm text-gray-400 mb-6">
                Indiquez votre e-mail, nous vous enverrons un lien pour le réinitialiser.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="input-field" placeholder="vous@exemple.com" autoFocus />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
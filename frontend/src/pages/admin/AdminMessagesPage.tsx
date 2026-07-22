import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { Bell, Send, Users, User, Search, CheckCircle } from 'lucide-react';

export default function AdminMessagesPage() {
  const api = useAdminApi();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [target, setTarget] = useState<'all' | 'user'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [type, setType] = useState('info');
  const [category, setCategory] = useState('system');
  const [message, setMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string>('');
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoadingHistory(true);
    try { setHistory(await api.get('/admin/notifications?limit=50')); }
    catch { setHistory([]); }
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const searchUsers = async () => {
    if (!userSearch.trim()) return setUserResults([]);
    const res = await api.get(`/admin/users?search=${encodeURIComponent(userSearch)}&limit=8`);
    setUserResults(res.users || []);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSent('');
    if (target === 'user' && !selectedUser) return setError('Sélectionnez un utilisateur');
    setSending(true);
    try {
      const res = await api.post('/admin/notifications/send', {
        target, userId: selectedUser?.id, type, category, message,
      });
      setSent(target === 'all' ? `Envoyée à ${res.sent} utilisateur(s)` : 'Notification envoyée');
      setMessage('');
      setSelectedUser(null);
      setUserSearch('');
      setUserResults([]);
      loadHistory();
      setTimeout(() => setSent(''), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi");
    } finally { setSending(false); }
  };

  const typeBadge = (t: string) => {
    const map: any = {
      info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      success: 'bg-green-500/10 text-green-400 border-green-500/20',
      warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${map[t] || map.info}`}>{t}</span>;
  };

  return (
    <div className="p-8 text-gray-800">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={20} className="text-orange-400" /> Messages
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Envoyer un message à un ou plusieurs utilisateurs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Formulaire d'envoi ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Nouvel envoi</h2>

          {error && <div className="mb-3 px-3 py-2 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}
          {sent && (
            <div className="mb-3 px-3 py-2 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100 flex items-center gap-2">
              <CheckCircle size={14} /> {sent}
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            {/* Cible */}
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Destinataires</label>
              <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50">
                <button type="button" onClick={() => { setTarget('all'); setSelectedUser(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    target === 'all' ? 'bg-white shadow-sm text-orange-500' : 'text-gray-400'
                  }`}>
                  <Users size={13} /> Tous les utilisateurs
                </button>
                <button type="button" onClick={() => setTarget('user')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    target === 'user' ? 'bg-white shadow-sm text-orange-500' : 'text-gray-400'
                  }`}>
                  <User size={13} /> Utilisateur spécifique
                </button>
              </div>
            </div>

            {/* Recherche utilisateur */}
            {target === 'user' && (
              <div>
                {selectedUser ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl">
                    <span className="text-sm text-gray-800">{selectedUser.name || selectedUser.email}</span>
                    <button type="button" onClick={() => setSelectedUser(null)} className="text-xs text-orange-500 hover:underline">
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchUsers())}
                        placeholder="Nom ou email..."
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                      <button type="button" onClick={searchUsers}
                        className="px-3 py-2 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-all">
                        <Search size={14} />
                      </button>
                    </div>
                    {userResults.length > 0 && (
                      <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {userResults.map(u => (
                          <button type="button" key={u.id} onClick={() => { setSelectedUser(u); setUserResults([]); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors">
                            {u.name || <span className="italic text-gray-400">Sans nom</span>} · <span className="text-gray-400">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Type + catégorie */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300">
                  <option value="info">Info</option>
                  <option value="success">Succès</option>
                  <option value="warning">Avertissement</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Catégorie</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300">
                  <option value="system">Message général</option>
                  <option value="appointment">Rendez-vous</option>
                  <option value="ticket">Billet</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={3}
                placeholder="Ex : Notre agence sera fermée le 15 août."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300 resize-none" />
            </div>

            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
              {sending
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={14} />}
              {target === 'all' ? 'Envoyer à tous' : "Envoyer à l'utilisateur"}
            </button>
          </form>
        </div>

        {/* ── Historique ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Historique des envois</h2>
          {loadingHistory ? (
            <p className="text-sm text-gray-500 text-center py-10">Chargement...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">Aucune notification envoyée</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {history.map((n: any) => (
                <div key={n.id} className="px-3 py-2.5 border border-gray-100 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{n.userName || `Utilisateur #${n.userId}`}</span>
                    {typeBadge(n.type)}
                  </div>
                  <p className="text-sm text-gray-700">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {n.created_at ? new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
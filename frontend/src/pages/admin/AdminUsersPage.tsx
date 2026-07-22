import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { Users, Search, Trash2, Eye, Calendar, Ticket, FileText, X, Pencil, Ban, ShieldCheck, Save } from 'lucide-react';

export default function AdminUsersPage() {
  const api = useAdminApi();
  const [data, setData] = useState<any>({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const load = async (s = '') => {
    setLoading(true);
    const res = await api.get(`/admin/users?search=${encodeURIComponent(s)}`);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleView = async (user: any) => {
    setSelected(user);
    setEditing(false);
    const res = await api.get(`/admin/users/${user.appwriteId ?? user.id}`);
    setDetail(res);
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Supprimer cet utilisateur et toutes ses données ?')) return;
    await api.del(`/admin/users/${id}`);
    setSelected(null); setDetail(null);
    load(search);
  };

  const openEdit = () => {
    setEditForm({ name: selected.name || '', phone: selected.phone || '', email: selected.email || '' });
    setEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put(`/admin/users/${selected.id}`, editForm);
      setSelected({ ...selected, ...updated });
      setEditing(false);
      load(search);
    } finally { setSaving(false); }
  };

  const handleToggleBlock = async () => {
    const willBlock = !selected.blocked;
    if (!confirm(willBlock ? 'Bloquer cet utilisateur ? Il ne pourra plus se connecter.' : 'Débloquer cet utilisateur ?')) return;
    setBlocking(true);
    try {
      await api.put(`/admin/users/${selected.id}/block`, { blocked: willBlock });
      setSelected({ ...selected, blocked: willBlock });
      load(search);
    } finally { setBlocking(false); }
  };

  return (
    <div className="p-8 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-orange-400" /> Utilisateurs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.total} inscrits</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
            className="px-4 py-2 bg-gray-50 border border-gray-700 rounded-xl text-sm text-gray-800 placeholder-gray-600 outline-none focus:border-orange-500 w-52"
            placeholder="Rechercher..." />
          <button onClick={() => load(search)}
            className="bg-orange-500 text-gray-900 px-4 py-2 rounded-xl text-sm hover:bg-orange-600 transition-all flex items-center gap-1.5">
            <Search size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nom', 'ID Appwrite', 'RDV', 'Billets', 'Statut', 'Inscrit le', ''].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-600">Chargement...</td></tr>
              ) : data.users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-600">Aucun utilisateur</td></tr>
              ) : data.users.map((u: any) => (
                <tr key={u.id}
                  className={`border-b border-gray-100 hover:bg-orange-50/30 transition-colors cursor-pointer ${selected?.id === u.id ? 'bg-orange-500/5' : ''}`}
                  onClick={() => handleView(u)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-xs text-orange-400 font-bold">
                        {(u.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800">{u.name || <span className="text-gray-600 italic">Sans nom</span>}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono">{u.appwriteId?.slice(0, 12)}...</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">{u.appointmentCount}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{u.ticketCount}</span>
                  </td>
                  <td className="px-5 py-3">
                    {u.blocked
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">Bloqué</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-500 border border-green-500/20">Actif</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-5 py-3">
                    <button onClick={e => { e.stopPropagation(); handleView(u); }}
                      className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Détail */}
        {selected && (
          <div className="w-80 bg-white border border-gray-100 rounded-2xl p-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Détail</h3>
              <div className="flex gap-1.5">
                <button onClick={openEdit}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/10 text-orange-500 text-xs rounded-lg border border-orange-500/20 hover:bg-orange-500/20 transition-all">
                  <Pencil size={11} /> Modifier
                </button>
                <button onClick={handleToggleBlock} disabled={blocking}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-50 ${
                    selected.blocked
                      ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20'
                  }`}>
                  {selected.blocked ? <ShieldCheck size={11} /> : <Ban size={11} />}
                  {selected.blocked ? 'Débloquer' : 'Bloquer'}
                </button>
                <button onClick={() => handleDelete(selected.appwriteId ?? selected.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all">
                  <Trash2 size={11} />
                </button>
                <button onClick={() => { setSelected(null); setDetail(null); setEditing(false); }}
                  className="p-1.5 text-gray-500 hover:text-gray-600"><X size={14} /></button>
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleSaveEdit} className="space-y-3 border-t border-gray-100 pt-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nom</label>
                  <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Téléphone</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-xs font-medium px-3 py-2 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
                    {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditing(false)}
                    className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-all">
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-gray-500">Nom</span><span>{selected.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="truncate max-w-[160px]">{selected.email || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Téléphone</span><span>{selected.phone || '—'}</span></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Statut</span>
                  <span className={selected.blocked ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                    {selected.blocked ? 'Bloqué' : 'Actif'}
                  </span>
                </div>
              </div>
            )}

            {detail && !editing && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Calendar size={11} /> {detail.appointments?.length} Rendez-vous</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {detail.appointments?.slice(0, 5).map((a: any) => (
                      <div key={a.id} className="text-xs text-gray-500 py-1 border-b border-gray-100">
                        {a.title} · {a.dateTime ? new Date(a.dateTime).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    ))}
                    {!detail.appointments?.length && <p className="text-xs text-gray-600">Aucun</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Ticket size={11} /> {detail.tickets?.length} Billets</p>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {detail.tickets?.slice(0, 4).map((t: any) => (
                      <div key={t.id} className="text-xs text-gray-500 py-1 border-b border-gray-100">
                        {t.origin} → {t.destination} · {t.price}€
                      </div>
                    ))}
                    {!detail.tickets?.length && <p className="text-xs text-gray-600">Aucun</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><FileText size={11} /> {detail.documents?.length} Documents</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
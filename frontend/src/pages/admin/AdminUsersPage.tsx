import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useadminapi';
import { Users, Search, Trash2, Eye, Calendar, Ticket, FileText, X } from 'lucide-react';

export default function AdminUsersPage() {
  const api = useAdminApi();
  const [data, setData] = useState<any>({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = async (s = '') => {
    setLoading(true);
    const res = await api.get(`/admin/users?search=${encodeURIComponent(s)}`);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleView = async (user: any) => {
    setSelected(user);
    const res = await api.get(`/admin/users/${user.appwriteId}`);
    setDetail(res);
  };

  const handleDelete = async (appwriteId: string) => {
    if (!confirm('Supprimer cet utilisateur et toutes ses données ?')) return;
    await api.del(`/admin/users/${appwriteId}`);
    setSelected(null); setDetail(null);
    load(search);
  };

  return (
    <div className="p-8 text-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-orange-400" /> Utilisateurs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.total} inscrits</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500 w-52"
            placeholder="Rechercher..." />
          <button onClick={() => load(search)}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-600 transition-all flex items-center gap-1.5">
            <Search size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Nom', 'ID Appwrite', 'RDV', 'Billets', 'Inscrit le', ''].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-600">Chargement...</td></tr>
              ) : data.users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-600">Aucun utilisateur</td></tr>
              ) : data.users.map((u: any) => (
                <tr key={u.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${selected?.id === u.id ? 'bg-orange-500/5' : ''}`}
                  onClick={() => handleView(u)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-xs text-orange-400 font-bold">
                        {(u.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-200">{u.name || <span className="text-gray-600 italic">Sans nom</span>}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono">{u.appwriteId?.slice(0, 12)}...</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">{u.appointmentCount}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">{u.ticketCount}</span>
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
          <div className="w-72 bg-gray-900 border border-gray-800 rounded-2xl p-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-sm">Détail</h3>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(selected.appwriteId)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all">
                  <Trash2 size={11} /> Supprimer
                </button>
                <button onClick={() => { setSelected(null); setDetail(null); }}
                  className="p-1.5 text-gray-500 hover:text-gray-300"><X size={14} /></button>
              </div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Nom</span><span>{selected.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Téléphone</span><span>{selected.phone || '—'}</span></div>
            </div>

            {detail && (
              <div className="space-y-4 border-t border-gray-800 pt-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Calendar size={11} /> {detail.appointments?.length} Rendez-vous</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {detail.appointments?.slice(0, 5).map((a: any) => (
                      <div key={a.id} className="text-xs text-gray-400 py-1 border-b border-gray-800">
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
                      <div key={t.id} className="text-xs text-gray-400 py-1 border-b border-gray-800">
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
import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useModalA11y } from '../../hooks/useModalA11y';
import AccessibleIconButton from '../../components/common/AccessibleIconButton';
import { Calendar, Trash2, Pencil, Ban, X, Save } from 'lucide-react';

export default function AdminAppointmentsPage() {
  const api = useAdminApi();
  const [data, setData] = useState<any>({ appointments: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const [editing, setEditing] = useState<any>(null);
  const modalRef = useModalA11y(!!editing, () => setEditing(null));
  const [form, setForm] = useState({ title: '', description: '', dateTime: '', location: '', status: 'upcoming' });
  const [saving, setSaving] = useState(false);

  const load = async (s = status) => {
    setLoading(true);
    const res = await api.get(`/admin/appointments?limit=50${s ? `&status=${s}` : ''}`);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    await api.del(`/admin/appointments/${id}`);
    load();
  };

  const handleBlock = async (id: number) => {
    if (!confirm('Bloquer (annuler) ce rendez-vous ?')) return;
    await api.put(`/admin/appointments/${id}/block`, {});
    load();
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      title: a.title || '',
      description: a.description || '',
      dateTime: a.dateTime ? new Date(a.dateTime).toISOString().slice(0, 16) : '',
      location: a.location || '',
      status: a.status || 'upcoming',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/appointments/${editing.id}`, form);
      setEditing(null);
      load();
    } finally { setSaving(false); }
  };

  const badge = (s: string) => {
    const map: any = {
      upcoming: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const labels: any = { upcoming: 'À venir', completed: 'Terminé', cancelled: 'Annulé' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${map[s] || map.upcoming}`}>{labels[s]}</span>;
  };

  return (
    <div className="p-8 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={20} className="text-orange-400" /> Rendez-vous
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.total} au total</p>
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); load(e.target.value); }}
          className="px-4 py-2 bg-gray-50 border border-gray-700 rounded-xl text-sm text-gray-600 outline-none focus:border-orange-500">
          <option value="">Tous les statuts</option>
          <option value="upcoming">À venir</option>
          <option value="completed">Terminés</option>
          <option value="cancelled">Annulés</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Titre', 'Utilisateur', 'Date & Heure', 'Lieu', 'Statut', ''].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600">Chargement...</td></tr>
            ) : data.appointments.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-gray-800">{a.title}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{a.userName || <span className="text-gray-600 italic">—</span>}</td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {a.dateTime ? new Date(a.dateTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{a.location || '—'}</td>
                <td className="px-5 py-3">{badge(a.status)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(a)}
                      className="p-1.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    {a.status !== 'cancelled' && (
                      <button onClick={() => handleBlock(a.id)}
                        className="p-1.5 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all" title="Bloquer">
                        <Ban size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !data.appointments.length && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600">Aucun rendez-vous</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal édition */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Modifier le rendez-vous"
            className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Modifier le rendez-vous</h3>
              <AccessibleIconButton
                icon={<X size={18} />}
                label="Fermer la fenêtre de modification"
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-600"
              />
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Titre</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date & heure</label>
                  <input type="datetime-local" value={form.dateTime} onChange={e => setForm({ ...form, dateTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300">
                    <option value="upcoming">À venir</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lieu</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50 mt-2">
                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { Ticket, Trash2, ArrowRight } from 'lucide-react';

export default function AdminTicketsPage() {
  const api = useAdminApi();
  const [data, setData] = useState<any>({ tickets: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = async (s = status) => {
    setLoading(true);
    const res = await api.get(`/admin/tickets?limit=50${s ? `&status=${s}` : ''}`);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce billet ?')) return;
    await api.del(`/admin/tickets/${id}`);
    load();
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
            <Ticket size={20} className="text-orange-400" /> Billets de vol
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
              {['Vol', 'Trajet', 'Utilisateur', 'Départ', 'Prix', 'Statut', ''].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-600">Chargement...</td></tr>
            ) : data.tickets.map((t: any) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{t.flightNumber || '—'}</td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
                    {t.origin} <ArrowRight size={11} className="text-orange-400" /> {t.destination}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{t.userName || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {t.departureDate ? new Date(t.departureDate).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="px-5 py-3 text-sm text-orange-400 font-medium">
                  {t.price ? `${t.price} ${t.currency}` : '—'}
                </td>
                <td className="px-5 py-3">{badge(t.status)}</td>
                <td className="px-5 py-3">
                  <button onClick={() => handleDelete(t.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !data.tickets.length && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-600">Aucun billet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
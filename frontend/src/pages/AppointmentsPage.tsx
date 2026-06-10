import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Calendar, Plus, Trash2, MapPin, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Appointment {
  id: number;
  title: string;
  description?: string;
  dateTime: string;
  location?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

const statusConfig = {
  upcoming: { label: 'À venir', icon: Clock, class: 'badge-orange' },
  completed: { label: 'Terminé', icon: CheckCircle, class: 'badge-green' },
  cancelled: { label: 'Annulé', icon: XCircle, class: 'badge-red' },
};

export default function AppointmentsPage() {
  const api = useApi();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dateTime: '', location: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/appointments');
      setAppointments(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/appointments', form);
      setForm({ title: '', description: '', dateTime: '', location: '' });
      setShowForm(false);
      await load();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    await api.del(`/appointments/${id}`);
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const handleStatus = async (id: number, status: string) => {
    await api.put(`/appointments/${id}`, { ...appointments.find(a => a.id === id), status });
    await load();
  };

  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (dt: string) => {
    return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const upcoming = appointments.filter(a => a.status === 'upcoming');
  const past = appointments.filter(a => a.status !== 'upcoming');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Calendar size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Rendez-vous</h1>
            <p className="text-xs text-gray-400">{upcoming.length} à venir</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          Nouveau
        </button>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* New appointment form */}
        {showForm && (
          <div className="card border-orange-100 bg-orange-50/30">
            <h3 className="font-medium text-gray-800 mb-4 text-sm">Nouveau rendez-vous</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Titre" required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="input-field" />
              <textarea placeholder="Description (optionnel)" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="input-field resize-none" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" required value={form.dateTime}
                  onChange={e => setForm({ ...form, dateTime: e.target.value })}
                  className="input-field" />
                <input type="text" placeholder="Lieu (optionnel)" value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="input-field" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                  {submitting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enregistrer'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">À venir</h2>
                <div className="space-y-3">
                  {upcoming.map(apt => (
                    <div key={apt.id} className="card hover:border-orange-100 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-medium text-gray-900 text-sm">{apt.title}</h3>
                            <span className={`badge-orange text-xs`}>
                              <Clock size={10} /> À venir
                            </span>
                          </div>
                          {apt.description && <p className="text-xs text-gray-400 mb-2">{apt.description}</p>}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} className="text-orange-400" />
                              {formatDate(apt.dateTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-orange-400" />
                              {formatTime(apt.dateTime)}
                            </span>
                            {apt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-orange-400" />
                                {apt.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleStatus(apt.id, 'completed')}
                            className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all" title="Marquer terminé">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => handleDelete(apt.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Historique</h2>
                <div className="space-y-2">
                  {past.map(apt => {
                    const cfg = statusConfig[apt.status];
                    return (
                      <div key={apt.id} className="card opacity-60 hover:opacity-80 transition-opacity">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-700 text-sm truncate">{apt.title}</h3>
                              <span className={`${cfg.class} text-xs`}>{cfg.label}</span>
                            </div>
                            <p className="text-xs text-gray-400">{formatDate(apt.dateTime)} · {formatTime(apt.dateTime)}</p>
                          </div>
                          <button onClick={() => handleDelete(apt.id)}
                            className="p-2 text-gray-200 hover:text-red-400 rounded-xl transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {appointments.length === 0 && !showForm && (
              <div className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                  <Calendar size={24} className="text-orange-300" />
                </div>
                <p className="text-sm text-gray-400">Aucun rendez-vous pour le moment</p>
                <button onClick={() => setShowForm(true)} className="mt-4 text-orange-500 text-sm hover:underline">
                  Créer votre premier rendez-vous
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { CalendarDays, Trash2, ChevronLeft, ChevronRight, Hash, Users } from 'lucide-react';

// Lundi de la semaine contenant `d`
function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = dimanche
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function AdminWeeklyPage() {
  const api = useAdminApi();
  const [weekOffset, setWeekOffset] = useState(0);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = getMonday(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const load = async () => {
    setLoading(true);
    try {
      const fromDate = weekStart.toISOString().slice(0, 10);
      const toDate = weekDays[6].toISOString().slice(0, 10);
      const res = await api.get(`/admin/waitlist?from=${fromDate}&to=${toDate}`);
      setWaitlist(res || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [weekOffset]);

  const handleRemoveFromWaitlist = async (id: number) => {
    if (!confirm("Retirer cette personne de la liste d'attente ?")) return;
    await api.del(`/admin/waitlist/${id}`);
    load();
  };

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const waitlistForDay = (d: Date) =>
    waitlist
      .filter((w: any) => w.date && new Date(w.date).toDateString() === d.toDateString())
      .sort((a: any, b: any) => a.rank - b.rank);

  return (
    <div className="p-8 text-gray-800">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={20} className="text-orange-400" /> Liste hebdomadaire
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{waitlist.length} en liste d'attente cette semaine</p>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all">
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        {' — '}
        {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((d, i) => {
            const dayWaitlist = waitlistForDay(d);
            return (
              <div key={i} className={`bg-white border rounded-2xl p-3 min-h-[180px] ${
                isToday(d) ? 'border-orange-300 ring-1 ring-orange-100' : 'border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isToday(d) ? 'text-orange-500' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </p>
                    <p className={`text-sm font-bold ${isToday(d) ? 'text-orange-500' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </p>
                  </div>
                  {dayWaitlist.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-500 font-medium">
                      {dayWaitlist.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayWaitlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-300">
                      <Users size={16} className="mb-1" />
                      <p className="text-xs">Vide</p>
                    </div>
                  ) : dayWaitlist.map((w: any) => (
                    <div key={w.id} className="group px-2 py-1.5 rounded-lg bg-purple-50/60 hover:bg-purple-50 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-purple-500">
                          <Hash size={10} /> {w.rank}
                        </span>
                        <button onClick={() => handleRemoveFromWaitlist(w.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all">
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-800 font-medium truncate mt-0.5">{w.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {w.quantity} personne{w.quantity > 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
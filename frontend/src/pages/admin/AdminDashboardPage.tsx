import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../hooks/useAuth';
import { Users, Calendar, Ticket, FileText, TrendingUp, Clock, Bot, Target, MapPin } from 'lucide-react';

// Mini bar chart en CSS pur — pas de dépendance à installer
function BarChart({ data, bars, colors, formatLabel }: {
  data: any[];
  bars: { key: string; label: string }[];
  colors: string[];
  formatLabel?: (month: string) => string;
}) {
  const max = Math.max(1, ...data.flatMap(d => bars.map(b => d[b.key] || 0)));
  if (!data.length) return <p className="text-sm text-gray-600 text-center py-10">Pas encore de données</p>;
  return (
    <div>
      <div className="flex items-end gap-3 h-32">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex items-end justify-center gap-1 h-full">
            {bars.map((b, bi) => (
              <div key={b.key} className="flex-1 rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(4, ((d[b.key] || 0) / max) * 100)}%`,
                  backgroundColor: colors[bi],
                }}
                title={`${b.label} : ${d[b.key] || 0}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-gray-500">
            {formatLabel ? formatLabel(d.month) : d.month}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3">
        {bars.map((b, bi) => (
          <div key={b.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[bi] }} />
            <span className="text-xs text-gray-500">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const api = useAdminApi();
  const { adminUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(setStats).finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { icon: Users, label: 'Utilisateurs', value: stats.totalUsers, sub: '', color: 'bg-blue-500' },
    { icon: Calendar, label: 'Rendez-vous', value: stats.totalAppointments, sub: `${stats.upcomingAppointments} à venir`, color: 'bg-orange-500' },
    { icon: Ticket, label: 'Billets', value: stats.totalTickets, sub: `${stats.upcomingTickets} à venir`, color: 'bg-purple-500' },
    { icon: FileText, label: 'Documents', value: stats.totalDocuments, sub: '', color: 'bg-green-500' },
  ] : [];

  const monthLabel = (m: string) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 text-gray-800">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, <span className="text-orange-400">{adminUser?.username}</span> 
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble Nestor Vocal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-gray-900" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
              {sub && <p className="text-xs text-gray-600">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Assistant IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.ia?.conversationsToday ?? 0}</p>
            <p className="text-sm text-gray-500">Échanges IA aujourd'hui</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.ia?.totalUsers ?? 0}</p>
            <p className="text-sm text-gray-500">Utilisateurs ayant parlé à Nestor</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Target size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.ia?.conversionRate ?? 0}%</p>
            <p className="text-sm text-gray-500">Conversion conversation → billet</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Réservations par mois */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-orange-400" /> Réservations par mois
          </h2>
          <BarChart
            data={stats?.bookingsByMonth || []}
            bars={[{ key: 'appointments', label: 'Rendez-vous' }, { key: 'tickets', label: 'Billets' }]}
            colors={['#fb923c', '#a855f7']}
            formatLabel={monthLabel}
          />
        </div>

        {/* Destinations populaires */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <MapPin size={15} className="text-orange-400" /> Destinations populaires
          </h2>
          {stats?.topDestinations?.length ? (
            <div className="space-y-3">
              {stats.topDestinations.map((d: any, i: number) => {
                const max = stats.topDestinations[0].count || 1;
                return (
                  <div key={d.destination}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">{d.destination}</span>
                      <span>{d.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600 text-center py-10">Aucun billet enregistré</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nouveaux utilisateurs */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <Users size={15} className="text-orange-400" /> Nouveaux utilisateurs
          </h2>
          <BarChart
            data={stats?.newUsersByMonth || []}
            bars={[{ key: 'count', label: 'Inscriptions' }]}
            colors={['#fb923c']}
            formatLabel={monthLabel}
          />
        </div>

        {/* Activité récente */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <Clock size={15} className="text-orange-400" /> Activité récente (7 jours)
          </h2>
          {stats?.recentActivity?.length ? (
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 8).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    {a.type === 'appointment'
                      ? <Calendar size={13} className="text-orange-400" />
                      : <Ticket size={13} className="text-purple-400" />}
                    <span className="text-sm text-gray-600">{a.type === 'appointment' ? 'Rendez-vous' : 'Billet'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">+{a.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 text-center py-6">Aucune activité récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
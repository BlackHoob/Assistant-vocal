import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useadminapi';
import { useAuth } from '../../hooks/useAuth';
import { Users, Calendar, Ticket, FileText, TrendingUp, Clock } from 'lucide-react';

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

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 text-gray-200">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Bonjour, <span className="text-orange-400">{adminUser?.username}</span> 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble — Nestor Vocal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
              {sub && <p className="text-xs text-gray-600">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activité */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-orange-400" /> Activité récente (7 jours)
          </h2>
          {stats?.recentActivity?.length ? (
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 8).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    {a.type === 'appointment'
                      ? <Calendar size={13} className="text-orange-400" />
                      : <Ticket size={13} className="text-purple-400" />}
                    <span className="text-sm text-gray-300">{a.type === 'appointment' ? 'Rendez-vous' : 'Billet'}</span>
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

        {/* Infos système */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Clock size={15} className="text-orange-400" /> Système
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'Base de données', value: 'MySQL 8 ✅' },
              { label: 'Auth utilisateurs', value: 'Appwrite Cloud ✅' },
              { label: 'Auth admin', value: 'JWT + bcrypt ✅' },
              { label: 'IA', value: 'Groq LLaMA 3.3 70B' },
              { label: 'Voix', value: 'ElevenLabs' },
              { label: 'Vols', value: 'Amadeus API' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm text-gray-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
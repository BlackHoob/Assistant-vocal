import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import {
  Bell, Calendar, Plane, FileText, Info, Trash2, CheckCircle,
  AlertTriangle, XCircle, Inbox,
} from 'lucide-react';

interface Notification {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error';
  category: 'appointment' | 'ticket' | 'document' | 'system';
  message: string;
  is_read: number | boolean;
  created_at: string;
}

const CATEGORY_ICON: Record<string, any> = {
  appointment: Calendar,
  ticket: Plane,
  document: FileText,
  system: Info,
};

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100' },
  info:    { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-100' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-100' },
  error:   { bg: 'bg-red-50',    text: 'text-red-500',    border: 'border-red-100' },
};

export default function NotificationsPage() {
  const api = useApi();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  // Au montage : charge la liste ET marque tout comme lu.
  // Le badge du header repasse donc à 0 jusqu'à la prochaine notif reçue.
  useEffect(() => {
    load();
    api.patch('/notifications/read-all').catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await api.del(`/notifications/${id}`); } catch { load(); }
  };

  const handleClearAll = async () => {
    if (!confirm('Effacer toutes les notifications ?')) return;
    setNotifications([]);
    try { await api.del('/notifications'); } catch { load(); }
  };

  const formatDate = (dt: string) => {
    const date = new Date(dt);
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffMin < 1440) return `Il y a ${Math.round(diffMin / 60)}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Bell size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-xs text-gray-400">
              {notifications.length} notification{notifications.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {notifications.length > 0 && (
          <button onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <Trash2 size={13} /> Tout effacer
          </button>
        )}
      </div>

      <div className="px-8 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Inbox size={24} className="text-orange-300" />
            </div>
            <p className="text-sm text-gray-400">Aucune notification pour le moment</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const CategoryIcon = CATEGORY_ICON[n.category] || Info;
              const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
              const isUnread = !n.is_read || n.is_read === 0;
              return (
                <div key={n.id}
                  className={`card flex items-start gap-3 group transition-colors ${
                    isUnread ? 'border-orange-100 bg-orange-50/20' : 'hover:border-orange-100'
                  }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${style.bg} ${style.border}`}>
                    <CategoryIcon size={16} className={style.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                  {isUnread && <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />}
                  <button onClick={() => handleDelete(n.id)}
                    className="p-1.5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
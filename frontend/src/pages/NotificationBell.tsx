import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface Props {
  /** Appelé au clic — à toi de naviguer vers /notifications selon ton système de routing. */
  onClick?: () => void;
}

export default function NotificationBell({ onClick }: Props) {
  const api = useApi();
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setCount(data.count || 0);
    } catch { /* silencieux — pas grave si un refresh échoue */ }
  };

  useEffect(() => {
    fetchCount();
    // Poll léger : le compteur se met à jour tout seul quand une notif
    // arrive (RDV pris, billet enregistré...), sans que l'utilisateur
    // ait besoin de rafraîchir la page.
    intervalRef.current = setInterval(fetchCount, 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
      title="Notifications"
    >
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
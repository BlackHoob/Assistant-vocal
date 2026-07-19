import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApi } from './useApi';

export interface UiNotification {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error';
  category: 'appointment' | 'ticket' | 'document' | 'system';
  message: string;
  time: string;
  read: boolean;
}

const POLL_MS = 20000; // rafraîchissement auto toutes les 20s
const REFRESH_EVENT = 'nestor:notifications:refresh';

// À appeler depuis n'importe quel composant (ex: après une réponse de
// l'IA, après avoir pris un RDV) pour forcer un rafraîchissement immédiat
// du badge, sans attendre le prochain polling.
export function triggerNotificationsRefresh() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

function formatTime(dt: string) {
  const date = new Date(dt);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffMin < 1440) return `Il y a ${Math.round(diffMin / 60)}h`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function useNotifications(enabled: boolean) {
  const api = useApi();
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.get('/notifications');
      const mapped: UiNotification[] = (Array.isArray(data) ? data : []).map((n: any) => ({
        id: n.id,
        type: n.type,
        category: n.category,
        message: n.message,
        time: formatTime(n.created_at),
        read: !!n.is_read,
      }));
      setNotifications(mapped);
    } catch { /* silencieux — pas grave si un refresh échoue */ }
  }, [enabled]);

  // Chargement initial + polling léger tant que les notifs sont activées.
  // C'est ce qui fait monter le badge tout seul quand Nestor confirme un
  // rendez-vous ou un billet, sans que l'utilisateur touche à rien.
  useEffect(() => {
    if (!enabled) { setNotifications([]); return; }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [enabled, refresh]);

  // Écoute l'événement global : n'importe quel écran peut demander un
  // rafraîchissement immédiat (ex: juste après que Nestor ait confirmé
  // une action) au lieu d'attendre le prochain tick du polling.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => refresh();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [enabled, refresh]);

  const unread = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    try { await api.patch(`/notifications/${id}/read`); } catch { refresh(); }
  }, [refresh]);

  // Appelé à l'ouverture du dropdown depuis le Layout (le compteur repasse
  // à 0 jusqu'à la prochaine vraie notification reçue).
  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.patch('/notifications/read-all'); } catch { refresh(); }
  }, [refresh]);

  const dismiss = useCallback(async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await api.del(`/notifications/${id}`); } catch { refresh(); }
  }, [refresh]);

  return { notifications, unread, markRead, markAllRead, dismiss, refresh };
}
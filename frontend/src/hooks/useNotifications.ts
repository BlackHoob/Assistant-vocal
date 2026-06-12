import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface AppNotification {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'appointment' | 'document' | 'ticket' | 'system';
  message: string;
  time: string;
  read: boolean;
}

export const useNotifications = (enabled: boolean) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!token || !enabled) return;
    try {
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Fusionner avec les "lus" stockés localement
        const readIds: number[] = JSON.parse(localStorage.getItem('notif_read') || '[]');
        setNotifications(data.map((n: AppNotification) => ({
          ...n,
          read: readIds.includes(n.id),
        })));
      }
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [token, enabled]);

  // Chargement initial + refresh toutes les 60 secondes
  useEffect(() => {
    fetchNotifications();
    if (!enabled) return;
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications, enabled]);

  const markRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const readIds: number[] = JSON.parse(localStorage.getItem('notif_read') || '[]');
    if (!readIds.includes(id)) {
      localStorage.setItem('notif_read', JSON.stringify([...readIds, id]));
    }
  };

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    localStorage.setItem('notif_read', JSON.stringify(ids));
  };

  const dismiss = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    markRead(id);
  };

  const unread = notifications.filter(n => !n.read).length;

  return { notifications, loading, unread, markRead, markAllRead, dismiss, refresh: fetchNotifications };
};
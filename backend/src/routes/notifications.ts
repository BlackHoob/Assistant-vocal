import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const notificationsRouter = Router();
notificationsRouter.use(authGuard);

export type NotifType = 'success' | 'info' | 'warning' | 'error';
export type NotifCategory = 'appointment' | 'ticket' | 'document' | 'system';

// ─── Helper réutilisable ──────────────────────────────────────────────────
// Appelé depuis appointments.ts, tickets.ts et voice.ts (function calling IA)
// à chaque événement réel (RDV pris, vol enregistré, annulation...).
export async function createNotification(
  userId: number,
  type: NotifType,
  category: NotifCategory,
  message: string
) {
  await pool.query(
    'INSERT INTO notifications (userId, type, category, message) VALUES (?, ?, ?, ?)',
    [userId, type, category, message]
  );
}

// Évite les doublons pour les notifications "système" recalculées à chaque
// visite (rappel RDV <24h, document qui expire...) : n'insère que si une
// notif identique n'a pas déjà été créée dans les dernières 24h.
async function upsertSystemNotification(
  userId: number,
  type: NotifType,
  category: NotifCategory,
  message: string
) {
  const [existing]: any = await pool.query(
    `SELECT id FROM notifications
     WHERE userId = ? AND category = ? AND message = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [userId, category, message]
  );
  if (existing.length === 0) {
    await createNotification(userId, type, category, message);
  }
}

// Recalcule les notifications "système" (rappels RDV, expiration documents,
// vols proches) et les insère en base si elles n'existent pas déjà.
// Reprend la logique qui existait avant, mais persistée au lieu d'être
// recalculée à chaque appel sans état.
async function syncSystemNotifications(userId: number) {
  // Rendez-vous dans les 24h
  const [upcoming]: any = await pool.query(
    `SELECT title, dateTime FROM appointments
     WHERE userId = ? AND status = 'upcoming'
       AND dateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
     ORDER BY dateTime ASC LIMIT 5`,
    [userId]
  );
  for (const apt of upcoming) {
    const dt = new Date(apt.dateTime);
    const diff = Math.round((dt.getTime() - Date.now()) / 60000);
    const timeLabel = diff < 60 ? `dans ${diff} min` : `dans ${Math.round(diff / 60)}h`;
    await upsertSystemNotification(userId, 'warning', 'appointment', `Rendez-vous "${apt.title}" ${timeLabel}`);
  }

  // Rendez-vous dans les 7 jours
  const [soon]: any = await pool.query(
    `SELECT title, dateTime FROM appointments
     WHERE userId = ? AND status = 'upcoming'
       AND dateTime BETWEEN DATE_ADD(NOW(), INTERVAL 24 HOUR) AND DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY dateTime ASC LIMIT 3`,
    [userId]
  );
  for (const apt of soon) {
    const dt = new Date(apt.dateTime);
    const label = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    await upsertSystemNotification(userId, 'info', 'appointment', `Rendez-vous "${apt.title}" le ${label}`);
  }

  // Documents expirant dans 30 jours
  const [expiring]: any = await pool.query(
    `SELECT name, expires_at FROM documents
     WHERE userId = ?
       AND expires_at IS NOT NULL
       AND expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     ORDER BY expires_at ASC LIMIT 5`,
    [userId]
  );
  for (const doc of expiring) {
    const exp = new Date(doc.expires_at);
    const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const docLabel = doc.name.replace(/^\[[^\]]+\]\s*/, '');
    await upsertSystemNotification(
      userId,
      days <= 7 ? 'warning' : 'info',
      'document',
      `Document "${docLabel}" expire dans ${days} jour${days > 1 ? 's' : ''}`
    );
  }

  // Documents expirés
  const [expired]: any = await pool.query(
    `SELECT name FROM documents
     WHERE userId = ? AND expires_at IS NOT NULL AND expires_at < CURDATE()
     ORDER BY expires_at DESC LIMIT 3`,
    [userId]
  );
  for (const doc of expired) {
    const docLabel = doc.name.replace(/^\[[^\]]+\]\s*/, '');
    await upsertSystemNotification(userId, 'error', 'document', `Document "${docLabel}" est expiré`);
  }

  // Billets à venir dans les 7 jours
  const [tickets]: any = await pool.query(
    `SELECT flightNumber, origin, destination, departureDate FROM tickets
     WHERE userId = ? AND status = 'upcoming'
       AND departureDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY departureDate ASC LIMIT 3`,
    [userId]
  );
  for (const t of tickets) {
    const dt = new Date(t.departureDate);
    const label = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    await upsertSystemNotification(
      userId,
      'info',
      'ticket',
      `Vol ${t.flightNumber || ''} ${t.origin} → ${t.destination} le ${label}`
    );
  }
}

// ─── Routes HTTP ──────────────────────────────────────────────────────────

// GET /api/notifications — liste complète (plus récentes en premier)
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await syncSystemNotifications(userId);
    const [rows]: any = await pool.query(
      'SELECT * FROM notifications WHERE userId = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /api/notifications/unread-count — pour le badge du menu
notificationsRouter.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND is_read = 0',
      [req.user!.id]
    );
    res.json({ count: rows[0].count });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/notifications/read-all — appelé quand l'utilisateur ouvre la page
// notifications : remet le compteur à 0 jusqu'à la prochaine notif reçue.
notificationsRouter.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE userId = ? AND is_read = 0', [req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/notifications/:id/read — marquer une seule notif comme lue
notificationsRouter.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notifications/:id — supprimer une notif
notificationsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notifications — tout effacer
notificationsRouter.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM notifications WHERE userId = ?', [req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
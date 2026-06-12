import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const notificationsRouter = Router();
notificationsRouter.use(authGuard);

// GET /api/notifications — données réelles depuis MySQL
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications: any[] = [];
    let id = 1;

    // ── Rendez-vous dans les 24h ──────────────────────────
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
      notifications.push({
        id: id++,
        type: 'warning',
        category: 'appointment',
        message: `Rendez-vous "${apt.title}" ${timeLabel}`,
        time: dt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        read: false,
      });
    }

    // ── Rendez-vous dans les 7 jours ─────────────────────
    const [soon]: any = await pool.query(
      `SELECT title, dateTime FROM appointments
       WHERE userId = ? AND status = 'upcoming'
         AND dateTime BETWEEN DATE_ADD(NOW(), INTERVAL 24 HOUR) AND DATE_ADD(NOW(), INTERVAL 7 DAY)
       ORDER BY dateTime ASC LIMIT 3`,
      [userId]
    );
    for (const apt of soon) {
      const dt = new Date(apt.dateTime);
      notifications.push({
        id: id++,
        type: 'info',
        category: 'appointment',
        message: `Rendez-vous "${apt.title}" le ${dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        time: dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        read: false,
      });
    }

    // ── Documents expirant dans 30 jours ─────────────────
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
      notifications.push({
        id: id++,
        type: days <= 7 ? 'warning' : 'info',
        category: 'document',
        message: `Document "${docLabel}" expire dans ${days} jour${days > 1 ? 's' : ''}`,
        time: exp.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        read: false,
      });
    }

    // ── Documents expirés ────────────────────────────────
    const [expired]: any = await pool.query(
      `SELECT name FROM documents
       WHERE userId = ? AND expires_at IS NOT NULL AND expires_at < CURDATE()
       ORDER BY expires_at DESC LIMIT 3`,
      [userId]
    );
    for (const doc of expired) {
      const docLabel = doc.name.replace(/^\[[^\]]+\]\s*/, '');
      notifications.push({
        id: id++,
        type: 'error',
        category: 'document',
        message: `Document "${docLabel}" est expiré`,
        time: 'Expiré',
        read: false,
      });
    }

    // ── Billets à venir dans les 7 jours ─────────────────
    const [tickets]: any = await pool.query(
      `SELECT flightNumber, origin, destination, departureDate FROM tickets
       WHERE userId = ? AND status = 'upcoming'
         AND departureDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
       ORDER BY departureDate ASC LIMIT 3`,
      [userId]
    );
    for (const t of tickets) {
      const dt = new Date(t.departureDate);
      notifications.push({
        id: id++,
        type: 'info',
        category: 'ticket',
        message: `Vol ${t.flightNumber || ''} ${t.origin} → ${t.destination} le ${dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
        time: dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        read: false,
      });
    }

    // ── Message de bienvenue si rien ─────────────────────
    if (notifications.length === 0) {
      notifications.push({
        id: 1,
        type: 'success',
        category: 'system',
        message: 'Bienvenue sur Nestor Vocal ! Tout est en ordre.',
        time: 'Maintenant',
        read: false,
      });
    }

    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationRow, NotificationType, NotificationCategory } from '../types';

export const notificationsRouter = Router();
notificationsRouter.use(authGuard);

const RECENT_DUPLICATE_WINDOW_HOURS = 24;
const APPOINTMENT_REMINDER_URGENT_HOURS = 24;
const APPOINTMENT_REMINDER_UPCOMING_DAYS = 7;
const DOCUMENT_EXPIRY_WARNING_DAYS = 30;
const DOCUMENT_EXPIRY_URGENT_DAYS = 7;
const TICKET_REMINDER_DAYS = 7;

// ─── Helper réutilisable ──────────────────────────────────────────────────
// Appelé depuis appointments.ts, tickets.ts et voice.ts (function calling IA)
// à chaque événement réel (RDV pris, vol enregistré, annulation...).
export async function createNotification(
  userId: number, type: NotificationType, category: NotificationCategory, message: string
): Promise<void> {
  await pool.query(
    'INSERT INTO notifications (userId, type, category, message) VALUES (?, ?, ?, ?)',
    [userId, type, category, message]
  );
}

// Évite les doublons pour les notifications "système" recalculées à chaque
// visite (rappel RDV, expiration document...) : n'insère que si une
// notification identique n'a pas déjà été créée récemment.
export async function createNotificationIfNotRecent(
  userId: number, type: NotificationType, category: NotificationCategory, message: string
): Promise<void> {
  const [existing] = await pool.query(
    `SELECT id FROM notifications
     WHERE userId = ? AND category = ? AND message = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [userId, category, message, RECENT_DUPLICATE_WINDOW_HOURS]
  ) as [{ id: number }[], unknown];

  if (existing.length === 0) await createNotification(userId, type, category, message);
}

// Le nom d'un document stocke parfois un préfixe technique ("[passport] ")
// utilisé pour retrouver le type — on l'enlève avant affichage.
export const stripDocumentTypePrefix = (name: string) => name.replace(/^\[[^\]]+\]\s*/, '');

async function notifyUrgentAppointments(userId: number): Promise<void> {
  const [upcoming] = await pool.query(
    `SELECT title, dateTime FROM appointments
     WHERE userId = ? AND status = 'upcoming'
       AND dateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
     ORDER BY dateTime ASC LIMIT 5`,
    [userId, APPOINTMENT_REMINDER_URGENT_HOURS]
  ) as [{ title: string; dateTime: string }[], unknown];

  for (const appointment of upcoming) {
    const minutesLeft = Math.round((new Date(appointment.dateTime).getTime() - Date.now()) / 60000);
    const timeLabel = minutesLeft < 60 ? `dans ${minutesLeft} min` : `dans ${Math.round(minutesLeft / 60)}h`;
    await createNotificationIfNotRecent(userId, 'warning', 'appointment', `Rendez-vous "${appointment.title}" ${timeLabel}`);
  }
}

async function notifyUpcomingAppointments(userId: number): Promise<void> {
  const [soon] = await pool.query(
    `SELECT title, dateTime FROM appointments
     WHERE userId = ? AND status = 'upcoming'
       AND dateTime BETWEEN DATE_ADD(NOW(), INTERVAL ? HOUR) AND DATE_ADD(NOW(), INTERVAL ? DAY)
     ORDER BY dateTime ASC LIMIT 3`,
    [userId, APPOINTMENT_REMINDER_URGENT_HOURS, APPOINTMENT_REMINDER_UPCOMING_DAYS]
  ) as [{ title: string; dateTime: string }[], unknown];

  for (const appointment of soon) {
    const label = new Date(appointment.dateTime).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    await createNotificationIfNotRecent(userId, 'info', 'appointment', `Rendez-vous "${appointment.title}" le ${label}`);
  }
}

async function notifyExpiringDocuments(userId: number): Promise<void> {
  const [expiring] = await pool.query(
    `SELECT name, expires_at FROM documents
     WHERE userId = ? AND expires_at IS NOT NULL
       AND expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY expires_at ASC LIMIT 5`,
    [userId, DOCUMENT_EXPIRY_WARNING_DAYS]
  ) as [{ name: string; expires_at: string }[], unknown];

  for (const doc of expiring) {
    const daysLeft = Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    await createNotificationIfNotRecent(
      userId,
      daysLeft <= DOCUMENT_EXPIRY_URGENT_DAYS ? 'warning' : 'info',
      'document',
      `Document "${stripDocumentTypePrefix(doc.name)}" expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
    );
  }
}

async function notifyExpiredDocuments(userId: number): Promise<void> {
  const [expired] = await pool.query(
    `SELECT name FROM documents
     WHERE userId = ? AND expires_at IS NOT NULL AND expires_at < CURDATE()
     ORDER BY expires_at DESC LIMIT 3`,
    [userId]
  ) as [{ name: string }[], unknown];

  for (const doc of expired) {
    await createNotificationIfNotRecent(userId, 'error', 'document', `Document "${stripDocumentTypePrefix(doc.name)}" est expiré`);
  }
}

async function notifyUpcomingTickets(userId: number): Promise<void> {
  const [tickets] = await pool.query(
    `SELECT flightNumber, origin, destination, departureDate FROM tickets
     WHERE userId = ? AND status = 'upcoming'
       AND departureDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
     ORDER BY departureDate ASC LIMIT 3`,
    [userId, TICKET_REMINDER_DAYS]
  ) as [{ flightNumber: string; origin: string; destination: string; departureDate: string }[], unknown];

  for (const ticket of tickets) {
    const label = new Date(ticket.departureDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    await createNotificationIfNotRecent(
      userId, 'info', 'ticket',
      `Vol ${ticket.flightNumber || ''} ${ticket.origin} → ${ticket.destination} le ${label}`
    );
  }
}

// Recalcule les notifications "système" à chaque consultation de la liste,
// sans jamais créer de doublon récent (voir createNotificationIfNotRecent).
async function syncSystemNotifications(userId: number): Promise<void> {
  await notifyUrgentAppointments(userId);
  await notifyUpcomingAppointments(userId);
  await notifyExpiringDocuments(userId);
  await notifyExpiredDocuments(userId);
  await notifyUpcomingTickets(userId);
}

// ─── Routes HTTP ──────────────────────────────────────────────────────────

// GET /api/notifications — liste complète (plus récentes en premier)
notificationsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await syncSystemNotifications(userId);
  const [rows] = await pool.query(
    'SELECT * FROM notifications WHERE userId = ? ORDER BY created_at DESC LIMIT 50', [userId]
  ) as [NotificationRow[], unknown];
  res.json(rows);
}));

// GET /api/notifications/unread-count — pour le badge du menu
notificationsRouter.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND is_read = 0', [req.user!.id]
  ) as [{ count: number }[], unknown];
  res.json({ count: rows[0].count });
}));

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE userId = ? AND is_read = 0', [req.user!.id]);
  res.json({ success: true });
}));

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
  res.json({ success: true });
}));

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await pool.query('DELETE FROM notifications WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
  res.json({ success: true });
}));

// DELETE /api/notifications — tout effacer
notificationsRouter.delete('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  await pool.query('DELETE FROM notifications WHERE userId = ?', [req.user!.id]);
  res.json({ success: true });
}));


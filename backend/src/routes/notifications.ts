import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationType, NotificationCategory } from '../types';
import { MySqlNotificationRepository } from '../repository/notificationRepository';
import { MySqlAppointmentRepository } from '../repository/appointmentRepository';
import { MySqlDocumentRepository } from '../repository/documentRepository';
import { MySqlTicketRepository } from '../repository/ticketRepository';

export const notificationsRouter = Router();
notificationsRouter.use(authGuard);

const RECENT_DUPLICATE_WINDOW_HOURS = 24;
const APPOINTMENT_REMINDER_URGENT_HOURS = 24;
const APPOINTMENT_REMINDER_UPCOMING_DAYS = 7;
const DOCUMENT_EXPIRY_WARNING_DAYS = 30;
const DOCUMENT_EXPIRY_URGENT_DAYS = 7;
const TICKET_REMINDER_DAYS = 7;

const notificationRepository = new MySqlNotificationRepository();
const appointmentRepository = new MySqlAppointmentRepository();
const documentRepository = new MySqlDocumentRepository();
const ticketRepository = new MySqlTicketRepository();

// ─── Helpers réutilisables ──────────────────────────────────────────────
// Appelés depuis appointments.ts, tickets.ts, admin.ts et voice.ts
// (function calling IA) à chaque événement réel (RDV pris, vol enregistré,
// annulation...).
export async function createNotification(
  userId: number, type: NotificationType, category: NotificationCategory, message: string
): Promise<void> {
  await notificationRepository.create(userId, type, category, message);
}

// Évite les doublons pour les notifications "système" recalculées à chaque
// visite (rappel RDV, expiration document...) : n'insère que si une
// notification identique n'a pas déjà été créée récemment.
export async function createNotificationIfNotRecent(
  userId: number, type: NotificationType, category: NotificationCategory, message: string
): Promise<void> {
  const alreadyExists = await notificationRepository.existsRecent(userId, category, message, RECENT_DUPLICATE_WINDOW_HOURS);
  if (!alreadyExists) await createNotification(userId, type, category, message);
}

// Le nom d'un document stocke parfois un préfixe technique ("[passport] ")
// utilisé pour retrouver le type — on l'enlève avant affichage.
export const stripDocumentTypePrefix = (name: string) => name.replace(/^\[[^\]]+\]\s*/, '');

async function notifyUrgentAppointments(userId: number): Promise<void> {
  const upcoming = await appointmentRepository.findUpcomingWithinHours(userId, APPOINTMENT_REMINDER_URGENT_HOURS);
  for (const appointment of upcoming) {
    const minutesLeft = Math.round((new Date(appointment.dateTime).getTime() - Date.now()) / 60000);
    const timeLabel = minutesLeft < 60 ? `dans ${minutesLeft} min` : `dans ${Math.round(minutesLeft / 60)}h`;
    await createNotificationIfNotRecent(userId, 'warning', 'appointment', `Rendez-vous "${appointment.title}" ${timeLabel}`);
  }
}

async function notifyUpcomingAppointments(userId: number): Promise<void> {
  const soon = await appointmentRepository.findUpcomingBetween(userId, APPOINTMENT_REMINDER_URGENT_HOURS, APPOINTMENT_REMINDER_UPCOMING_DAYS);
  for (const appointment of soon) {
    const label = new Date(appointment.dateTime).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    await createNotificationIfNotRecent(userId, 'info', 'appointment', `Rendez-vous "${appointment.title}" le ${label}`);
  }
}

async function notifyExpiringDocuments(userId: number): Promise<void> {
  const expiring = await documentRepository.findExpiringWithinDays(userId, DOCUMENT_EXPIRY_WARNING_DAYS);
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
  const expired = await documentRepository.findExpired(userId);
  for (const doc of expired) {
    await createNotificationIfNotRecent(userId, 'error', 'document', `Document "${stripDocumentTypePrefix(doc.name)}" est expiré`);
  }
}

async function notifyUpcomingTickets(userId: number): Promise<void> {
  const tickets = await ticketRepository.findUpcomingWithinDays(userId, TICKET_REMINDER_DAYS);
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
  res.json(await notificationRepository.findAllByUser(userId, 50));
}));

// GET /api/notifications/unread-count — pour le badge du menu
notificationsRouter.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ count: await notificationRepository.countUnread(req.user!.id) });
}));

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationRepository.markAllRead(req.user!.id);
  res.json({ success: true });
}));

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationRepository.markOneRead(req.params.id, req.user!.id);
  res.json({ success: true });
}));

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationRepository.deleteOne(req.params.id, req.user!.id);
  res.json({ success: true });
}));

// DELETE /api/notifications — tout effacer
notificationsRouter.delete('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationRepository.deleteAllByUser(req.user!.id);
  res.json({ success: true });
}));


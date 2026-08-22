import { Router, Response } from 'express';
import path from 'path';
import { adminGuard, AdminRequest } from '../middleware/adminGuard';
import bcrypt from 'bcryptjs';
import { createNotification } from './notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { createUploadMiddleware, deleteUploadedFile } from '../utils/fileUpload';
import { ValidationError, ForbiddenError, ConflictError, NotFoundError } from '../errors/AppError';
import {
  DashboardStats, NotificationType, NotificationCategory, AdminRole, DocumentType,
} from '../types';
import { MySqlUserRepository } from '../repository/userRepository';
import { MySqlAppointmentRepository } from '../repository/appointmentRepository';
import { MySqlTicketRepository } from '../repository/ticketRepository';
import { MySqlDocumentRepository } from '../repository/documentRepository';
import { MySqlWaitlistRepository } from '../repository/waitlistRepository';
import { MySqlChatMessageRepository } from '../repository/chatMessageRepository';
import { MySqlStatsRepository } from '../repository/statsRepository';
import { MySqlAdminRepository } from '../repository/adminRepository';
import { MySqlNotificationRepository } from '../repository/notificationRepository';

// Même dossier et même limite de taille (20 Mo) que documents.ts, pour que
// les documents envoyés par l'admin et ceux envoyés par les clients suivent
// exactement la même convention.
const upload = createUploadMiddleware('documents', originalName => `${Date.now()}-${originalName}`, 20);

export const adminRouter = Router();
adminRouter.use(adminGuard);

const userRepository = new MySqlUserRepository();
const appointmentRepository = new MySqlAppointmentRepository();
const ticketRepository = new MySqlTicketRepository();
const documentRepository = new MySqlDocumentRepository();
const waitlistRepository = new MySqlWaitlistRepository();
const chatMessageRepository = new MySqlChatMessageRepository();
const statsRepository = new MySqlStatsRepository();
const adminRepository = new MySqlAdminRepository();
const notificationRepository = new MySqlNotificationRepository();

// Les routes /admins/* (gestion des comptes admin) sont réservées aux
// superadmins — ce contrôle était répété identiquement dans 3 routes.
function requireSuperadmin(req: AdminRequest): void {
  if (req.admin!.role !== 'superadmin') throw new ForbiddenError();
}

interface MonthlyCount { month: string; count: number }
interface MonthlyBookings { month: string; appointments: number; tickets: number }

// Fusionne deux séries mensuelles (ex: appointments + tickets) sur une clé "month" commune
export function mergeMonthlySeries(
  rowsA: MonthlyCount[], rowsB: MonthlyCount[], keyA: string, keyB: string
): MonthlyBookings[] {
  const map: Record<string, MonthlyBookings> = {};
  rowsA.forEach(r => {
    map[r.month] = { month: r.month, [keyA]: r.count, [keyB]: 0 } as unknown as MonthlyBookings;
  });
  rowsB.forEach(r => {
    if (!map[r.month]) map[r.month] = { month: r.month, [keyA]: 0, [keyB]: 0 } as unknown as MonthlyBookings;
    (map[r.month] as any)[keyB] = r.count;
  });
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

// ─────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/stats', asyncHandler(async (_req: AdminRequest, res: Response<DashboardStats>) => {
  const [
    totalUsers, totalAppointments, totalTickets, totalDocuments,
    upcomingAppointments, upcomingTickets, recentActivity,
    apptByMonth, ticketsByMonth, newUsersByMonth, topDestinations,
    totalIAMessages, totalIAUsers, iaConversationsToday, usersWithTicket,
  ] = await Promise.all([
    statsRepository.countUsers(),
    statsRepository.countAppointments(),
    statsRepository.countTickets(),
    statsRepository.countDocuments(),
    statsRepository.countUpcomingAppointments(),
    statsRepository.countUpcomingTickets(),
    statsRepository.getRecentActivity(),
    statsRepository.getAppointmentsByMonth(),
    statsRepository.getTicketsByMonth(),
    statsRepository.getNewUsersByMonth(),
    statsRepository.getTopDestinations(),
    chatMessageRepository.countTotal(),
    chatMessageRepository.countDistinctUsers(),
    chatMessageRepository.countAssistantToday(),
    statsRepository.countUsersWithTicket(),
  ]);

  const bookingsByMonth = mergeMonthlySeries(apptByMonth, ticketsByMonth, 'appointments', 'tickets');
  const conversionRate = totalIAUsers > 0 ? Math.round((usersWithTicket / totalIAUsers) * 1000) / 10 : 0;

  res.json({
    totalUsers, totalAppointments, totalTickets, totalDocuments,
    upcomingAppointments, upcomingTickets, recentActivity,
    bookingsByMonth, newUsersByMonth, topDestinations,
    ia: { totalMessages: totalIAMessages, totalUsers: totalIAUsers, conversationsToday: iaConversationsToday, conversionRate },
  });
}));

// ─────────────────────────────────────────────────────────────────────────
// Utilisateurs
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/users', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { search = '', page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    userRepository.findAdminList(search, parseInt(limit), offset),
    userRepository.countBySearch(search),
  ]);

  res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
}));

adminRouter.get('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const [user, appointments, tickets, documents] = await Promise.all([
    userRepository.findAdminById(req.params.id),
    appointmentRepository.findByUser(req.params.id, 10),
    ticketRepository.findByUser(req.params.id, 10),
    documentRepository.findByUser(req.params.id),
  ]);

  res.json({ user, appointments, tickets, documents });
}));

adminRouter.delete('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await userRepository.deleteById(req.params.id);
  res.json({ success: true });
}));

// Modifier un utilisateur (nom, téléphone, email)
adminRouter.put('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { name, phone, email } = req.body as { name?: string; phone?: string; email?: string };
  if (name === undefined && phone === undefined && email === undefined) {
    throw new ValidationError('Aucun champ à modifier');
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (email !== undefined) updateData.email = email;

  try {
    await userRepository.updateAdminFields(req.params.id, updateData);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new ConflictError('Email déjà utilisé');
    throw err;
  }

  res.json(await userRepository.findAdminById(req.params.id));
}));

// Bloquer / débloquer un utilisateur (empêche la connexion — voir authGuard/login)
adminRouter.put('/users/:id/block', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { blocked }: { blocked: boolean } = req.body;
  await userRepository.setBlocked(req.params.id, blocked);
  res.json({ success: true, blocked: !!blocked });
}));

// ─────────────────────────────────────────────────────────────────────────
// Rendez-vous
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/appointments', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { status, limit = '50', from, to } = req.query as Record<string, string>;
  const filters = { status, from, to, limit: parseInt(limit) };

  const [appointments, total] = await Promise.all([
    appointmentRepository.findAdminList(filters),
    appointmentRepository.countAdminList(filters),
  ]);

  res.json({ appointments, total });
}));

adminRouter.delete('/appointments/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await appointmentRepository.deleteById(req.params.id);
  res.json({ success: true });
}));

// Modifier un rendez-vous (titre, description, date/heure, lieu, statut)
adminRouter.put('/appointments/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { title, description, dateTime, location, status } = req.body;
  if ([title, description, dateTime, location, status].every(v => v === undefined)) {
    throw new ValidationError('Aucun champ à modifier');
  }

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description ?? '';
  if (dateTime !== undefined) updateData.dateTime = dateTime;
  if (location !== undefined) updateData.location = location ?? '';
  if (status !== undefined) updateData.status = status;
  await appointmentRepository.updateAdminFields(req.params.id, updateData);

  res.json(await appointmentRepository.findByIdWithUserName(req.params.id));
}));

// Bloquer un rendez-vous (raccourci : passe le statut à "cancelled")
adminRouter.put('/appointments/:id/block', asyncHandler(async (req: AdminRequest, res: Response) => {
  await appointmentRepository.setStatusById(req.params.id, 'cancelled');
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Liste d'attente — lecture pour l'admin (table `waitlist`, alimentée côté
// client par joinWaitlist dans appointments.ts). Le rang est recalculé par
// jour, comme côté client (getMyWaitlistPosition).
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/waitlist', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { date, from, to } = req.query as Record<string, string>;
  const rows = date
    ? await waitlistRepository.findByDate(date)
    : (from && to ? await waitlistRepository.findByRange(from, to) : await waitlistRepository.findAll());

  // Rang recalculé par jour (1 = premier inscrit de la journée)
  const countsByDate: Record<string, number> = {};
  const withRank = rows.map(w => {
    const key = String(w.date);
    countsByDate[key] = (countsByDate[key] || 0) + 1;
    return { ...w, rank: countsByDate[key] };
  });
  const totalsByDate: Record<string, number> = {};
  withRank.forEach(w => { totalsByDate[String(w.date)] = (totalsByDate[String(w.date)] || 0) + 1; });

  res.json(withRank.map(w => ({ ...w, total: totalsByDate[String(w.date)] })));
}));

adminRouter.delete('/waitlist/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await waitlistRepository.delete(req.params.id);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Billets
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/tickets', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { status, limit = '50' } = req.query as Record<string, string>;

  const [tickets, total] = await Promise.all([
    ticketRepository.findAdminList(status, parseInt(limit)),
    ticketRepository.countAdminList(status),
  ]);

  res.json({ tickets, total });
}));

adminRouter.delete('/tickets/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await ticketRepository.deleteById(req.params.id);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Conversations IA — lecture seule, pour supervision (table chat_messages,
// déjà alimentée par voice.ts, jamais exposée côté admin jusqu'ici)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/conversations', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, limit = '50' } = req.query as Record<string, string>;
  res.json(await chatMessageRepository.findAll(userId ? Number(userId) : undefined, parseInt(limit)));
}));

// ─────────────────────────────────────────────────────────────────────────
// Notifications — envoi ciblé ou broadcast depuis l'admin, réutilise le
// système de notifications déjà en place (createNotification)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.post('/notifications/send', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { target, userId, type, category, message }: {
    target: 'user' | 'all'; userId?: number; type?: NotificationType;
    category?: NotificationCategory; message: string;
  } = req.body;
  if (!message?.trim()) throw new ValidationError('Message requis');

  if (target === 'user') {
    if (!userId) throw new ValidationError('userId requis pour un envoi ciblé');
    await createNotification(userId, type || 'info', category || 'system', message);
    return res.json({ success: true, sent: 1 });
  }

  // Broadcast à tous les utilisateurs
  const userIds = await userRepository.findAllIds();
  await Promise.all(userIds.map(id => createNotification(id, type || 'info', category || 'system', message)));
  res.json({ success: true, sent: userIds.length });
}));

adminRouter.get('/notifications', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { limit = '50' } = req.query as Record<string, string>;
  res.json(await notificationRepository.findAdminList(parseInt(limit)));
}));

// ─────────────────────────────────────────────────────────────────────────
// Documents — l'admin envoie un document à un utilisateur (table `documents`,
// déjà utilisée côté client dans DocumentsPage)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.post('/documents/send', upload.single('file'), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, type, expiresAt }: { userId: number; type?: DocumentType; expiresAt?: string } = req.body;
  if (!userId) throw new ValidationError('userId requis');
  if (!req.file) throw new ValidationError('Fichier requis');

  const document = await documentRepository.createByAdmin({
    userId, name: type || 'other',
    filePath: `/uploads/documents/${req.file.filename}`,
    fileSize: req.file.size, mimeType: req.file.mimetype, expiresAt: expiresAt || null,
  });

  await createNotification(userId, 'info', 'document', `Un nouveau document (${type || 'autre'}) a été ajouté par l'agence`);

  res.status(201).json(document);
}));

adminRouter.get('/documents', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, limit = '50' } = req.query as Record<string, string>;
  res.json(await documentRepository.findAdminList(userId, parseInt(limit)));
}));

// Suppression : retire à la fois le fichier physique sur le disque et son
// enregistrement en base, comme le fait déjà la route équivalente côté
// client (documents.ts) — sans ça, le fichier restait orphelin sur le
// serveur après une suppression admin.
adminRouter.delete('/documents/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const document = await documentRepository.findByIdAdmin(req.params.id);
  if (!document) throw new NotFoundError('Document introuvable');

  deleteUploadedFile('documents', path.basename(document.file_path));
  await documentRepository.deleteById(req.params.id);
  res.json({ success: true });
}));

// Purge des documents expirés (politique de conservation RGPD) : supprime
// à la fois le fichier physique et l'enregistrement en base pour chaque
// document dont expires_at est dépassé, tous utilisateurs confondus.
// "Best effort" : l'échec sur un document (fichier déjà absent du disque,
// erreur base) est journalisé mais ne bloque jamais le traitement des
// documents suivants — même logique que pour la suppression d'un compte.
export async function purgeExpiredDocuments(): Promise<number> {
  const expired = await documentRepository.findAllExpired();
  let purged = 0;

  for (const document of expired) {
    try {
      deleteUploadedFile('documents', path.basename(document.file_path));
    } catch (err) {
      console.error(`Fichier déjà absent ou inaccessible : ${document.file_path}`, err);
    }
    try {
      await documentRepository.deleteById(String(document.id));
      purged++;
    } catch (err) {
      console.error(`Échec de suppression en base du document ${document.id}`, err);
    }
  }

  return purged;
}

adminRouter.post('/documents/purge-expired', asyncHandler(async (_req: AdminRequest, res: Response) => {
  const purged = await purgeExpiredDocuments();
  res.json({ success: true, purged });
}));

// ─────────────────────────────────────────────────────────────────────────
// Administrateurs (réservé aux superadmins)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/admins', asyncHandler(async (req: AdminRequest, res: Response) => {
  requireSuperadmin(req);
  res.json(await adminRepository.findAll());
}));

adminRouter.post('/admins', asyncHandler(async (req: AdminRequest, res: Response) => {
  requireSuperadmin(req);
  const { username, email, password, role }: {
    username: string; email: string; password: string; role?: AdminRole;
  } = req.body;

  const hash = await bcrypt.hash(password, 12);
  try {
    const { id } = await adminRepository.create({ username, email, passwordHash: hash, role: role || 'admin' });
    res.status(201).json({ id, username, email, role: role || 'admin' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new ConflictError('Username ou email déjà utilisé');
    throw err;
  }
}));

adminRouter.delete('/admins/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  requireSuperadmin(req);
  if (parseInt(req.params.id) === req.admin!.id) {
    throw new ValidationError('Impossible de supprimer votre propre compte');
  }
  await adminRepository.deleteById(req.params.id);
  res.json({ success: true });
}));
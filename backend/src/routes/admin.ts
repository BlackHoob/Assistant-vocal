import { Router, Response } from 'express';
import { adminGuard, AdminRequest } from '../middleware/adminGuard';
import { pool } from '../config/db';
import bcrypt from 'bcryptjs';
import { createNotification } from './notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { createUploadMiddleware } from '../utils/fileUpload';
import { ValidationError, ForbiddenError, ConflictError } from '../errors/AppError';
import {
  User, Appointment, Ticket, DocumentRow, NotificationRow,
  ChatMessage, DashboardStats, WaitlistEntry,
  NotificationType, NotificationCategory, Admin, AdminRole, DocumentType,
} from '../types';

// Même dossier et même limite de taille (20 Mo) que documents.ts, pour que
// les documents envoyés par l'admin et ceux envoyés par les clients suivent
// exactement la même convention. Avant : un multer() séparé ici, sans
// limite de taille — un admin (ou un token admin compromis) pouvait
// uploader un fichier de taille arbitraire et saturer le disque du serveur.
const upload = createUploadMiddleware(
  'documents',
  originalName => `${Date.now()}-${originalName}`,
  20
);

export const adminRouter = Router();
adminRouter.use(adminGuard);

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
  const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users') as [{ totalUsers: number }[], unknown];
  const [[{ totalAppointments }]] = await pool.query('SELECT COUNT(*) as totalAppointments FROM appointments') as [{ totalAppointments: number }[], unknown];
  const [[{ totalTickets }]] = await pool.query('SELECT COUNT(*) as totalTickets FROM tickets') as [{ totalTickets: number }[], unknown];
  const [[{ totalDocuments }]] = await pool.query('SELECT COUNT(*) as totalDocuments FROM documents') as [{ totalDocuments: number }[], unknown];
  const [[{ upcomingAppointments }]] = await pool.query("SELECT COUNT(*) as upcomingAppointments FROM appointments WHERE status='upcoming'") as [{ upcomingAppointments: number }[], unknown];
  const [[{ upcomingTickets }]] = await pool.query("SELECT COUNT(*) as upcomingTickets FROM tickets WHERE status='upcoming'") as [{ upcomingTickets: number }[], unknown];
  const [recentActivity] = await pool.query(`
    SELECT DATE(created_at) as date, COUNT(*) as count, 'appointment' as type FROM appointments
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
    UNION ALL
    SELECT DATE(created_at), COUNT(*), 'ticket' FROM tickets
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
    ORDER BY date DESC
  `) as [DashboardStats['recentActivity'], unknown];

  // ── Graphiques : réservations par mois (RDV + billets), 6 derniers mois ──
  const [apptByMonth] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM appointments
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];
  const [ticketsByMonth] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM tickets
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];
  const bookingsByMonth = mergeMonthlySeries(apptByMonth, ticketsByMonth, 'appointments', 'tickets');

  // ── Nouveaux utilisateurs par mois, 6 derniers mois ──
  const [newUsersByMonth] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM users
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];

  // ── Destinations les plus réservées ──
  const [topDestinations] = await pool.query(`
    SELECT destination, COUNT(*) as count FROM tickets
    WHERE destination IS NOT NULL AND destination != ''
    GROUP BY destination ORDER BY count DESC LIMIT 5`) as [DashboardStats['topDestinations'], unknown];

  // ── Assistant IA : volume de conversations + taux de conversion ──
  const [[{ totalIAMessages }]] = await pool.query('SELECT COUNT(*) as totalIAMessages FROM chat_messages') as [{ totalIAMessages: number }[], unknown];
  const [[{ totalIAUsers }]] = await pool.query('SELECT COUNT(DISTINCT userId) as totalIAUsers FROM chat_messages') as [{ totalIAUsers: number }[], unknown];
  const [[{ iaConversationsToday }]] = await pool.query(
    "SELECT COUNT(*) as iaConversationsToday FROM chat_messages WHERE role='assistant' AND DATE(created_at) = CURDATE()"
  ) as [{ iaConversationsToday: number }[], unknown];
  const [[{ usersWithTicket }]] = await pool.query('SELECT COUNT(DISTINCT userId) as usersWithTicket FROM tickets') as [{ usersWithTicket: number }[], unknown];
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

interface UserWithCounts extends User { appointmentCount: number; ticketCount: number }

adminRouter.get('/users', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { search = '', page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const like = `%${search}%`;

  const [users] = await pool.query(
    `SELECT u.*, COUNT(DISTINCT a.id) as appointmentCount, COUNT(DISTINCT t.id) as ticketCount
     FROM users u LEFT JOIN appointments a ON a.userId = u.id LEFT JOIN tickets t ON t.userId = u.id
     WHERE u.name LIKE ? OR u.email LIKE ?
     GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [like, like, parseInt(limit), offset]
  ) as [UserWithCounts[], unknown];
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) as total FROM users WHERE name LIKE ? OR email LIKE ?', [like, like]
  ) as [{ total: number }[], unknown];

  res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
}));

adminRouter.get('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const [user] = await pool.query(
    'SELECT id, name, email, avatar, phone, blocked, created_at FROM users WHERE id = ?', [req.params.id]
  ) as [User[], unknown];
  const [appointments] = await pool.query(
    'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime DESC LIMIT 10', [req.params.id]
  ) as [Appointment[], unknown];
  const [tickets] = await pool.query(
    'SELECT * FROM tickets WHERE userId = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]
  ) as [Ticket[], unknown];
  const [documents] = await pool.query(
    'SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [req.params.id]
  ) as [DocumentRow[], unknown];

  res.json({ user: user[0], appointments, tickets, documents });
}));

adminRouter.delete('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// Modifier un utilisateur (nom, téléphone, email)
adminRouter.put('/users/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { name, phone, email }: Partial<Pick<User, 'name' | 'phone' | 'email'>> = req.body;
  const fields: string[] = [];
  const params: (string | number)[] = [];
  if (name  !== undefined) { fields.push('name = ?');  params.push(name); }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
  if (email !== undefined) { fields.push('email = ?'); params.push(email); }
  if (!fields.length) throw new ValidationError('Aucun champ à modifier');

  params.push(req.params.id);
  try {
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new ConflictError('Email déjà utilisé');
    throw err;
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, phone, avatar, blocked, created_at FROM users WHERE id = ?', [req.params.id]
  ) as [User[], unknown];
  res.json(rows[0]);
}));

// Bloquer / débloquer un utilisateur (empêche la connexion — voir authGuard/login)
adminRouter.put('/users/:id/block', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { blocked }: { blocked: boolean } = req.body;
  await pool.query('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, req.params.id]);
  res.json({ success: true, blocked: !!blocked });
}));

// ─────────────────────────────────────────────────────────────────────────
// Rendez-vous
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/appointments', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { status, limit = '50', from, to } = req.query as Record<string, string>;
  const params: (string | number)[] = [];
  const conditions: string[] = [];
  if (status) { conditions.push('a.status = ?'); params.push(status); }
  if (from)   { conditions.push('a.dateTime >= ?'); params.push(from); }
  if (to)     { conditions.push('a.dateTime <= ?'); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit));

  const [rows] = await pool.query(
    `SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId ${where} ORDER BY a.dateTime ASC LIMIT ?`,
    params
  ) as [Appointment[], unknown];
  const countParams = conditions.length ? params.slice(0, -1) : [];
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM appointments a ${where}`, countParams
  ) as [{ total: number }[], unknown];

  res.json({ appointments: rows, total });
}));

adminRouter.delete('/appointments/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// Modifier un rendez-vous (titre, description, date/heure, lieu, statut)
adminRouter.put('/appointments/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { title, description, dateTime, location, status }: Partial<Appointment> = req.body;
  const fields: string[] = [];
  const params: (string | number)[] = [];
  if (title       !== undefined) { fields.push('title = ?');       params.push(title); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description ?? ''); }
  if (dateTime    !== undefined) { fields.push('dateTime = ?');    params.push(dateTime); }
  if (location    !== undefined) { fields.push('location = ?');    params.push(location ?? ''); }
  if (status      !== undefined) { fields.push('status = ?');      params.push(status); }
  if (!fields.length) throw new ValidationError('Aucun champ à modifier');

  params.push(req.params.id);
  await pool.query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.query(
    'SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId WHERE a.id = ?',
    [req.params.id]
  ) as [Appointment[], unknown];
  res.json(rows[0]);
}));

// Bloquer un rendez-vous (raccourci : passe le statut à "cancelled")
adminRouter.put('/appointments/:id/block', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Liste d'attente — lecture pour l'admin (table `waitlist`, alimentée côté
// client par joinWaitlist dans appointments.ts). Le rang est recalculé par
// jour, comme côté client (getMyWaitlistPosition).
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/waitlist', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { date, from, to } = req.query as Record<string, string>;
  const params: string[] = [];
  let where = '';
  if (date) { where = 'WHERE date = ?'; params.push(date); }
  else if (from && to) { where = 'WHERE date BETWEEN ? AND ?'; params.push(from, to); }

  const [rows] = await pool.query(
    `SELECT id, userId, name, date, quantity, created_at FROM waitlist ${where} ORDER BY date ASC, created_at ASC`,
    params
  ) as [WaitlistEntry[], unknown];

  // Rang recalculé par jour (1 = premier inscrit de la journée)
  const countsByDate: Record<string, number> = {};
  const withRank: WaitlistEntry[] = rows.map(w => {
    const key = String(w.date);
    countsByDate[key] = (countsByDate[key] || 0) + 1;
    return { ...w, rank: countsByDate[key] };
  });
  const totalsByDate: Record<string, number> = {};
  withRank.forEach(w => { totalsByDate[String(w.date)] = (totalsByDate[String(w.date)] || 0) + 1; });

  res.json(withRank.map(w => ({ ...w, total: totalsByDate[String(w.date)] })));
}));

adminRouter.delete('/waitlist/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query('DELETE FROM waitlist WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Billets
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/tickets', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { status, limit = '50' } = req.query as Record<string, string>;
  const params: (string | number)[] = [];
  let where = '';
  if (status) { where = 'WHERE t.status = ?'; params.push(status); }
  params.push(parseInt(limit));

  const [rows] = await pool.query(
    `SELECT t.*, u.name as userName FROM tickets t LEFT JOIN users u ON u.id = t.userId ${where} ORDER BY t.created_at DESC LIMIT ?`,
    params
  ) as [Ticket[], unknown];
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM tickets${status ? ' WHERE status = ?' : ''}`,
    status ? [status] : []
  ) as [{ total: number }[], unknown];

  res.json({ tickets: rows, total });
}));

adminRouter.delete('/tickets/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query('DELETE FROM tickets WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Conversations IA — lecture seule, pour supervision (table chat_messages,
// déjà alimentée par voice.ts, jamais exposée côté admin jusqu'ici)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/conversations', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, limit = '50' } = req.query as Record<string, string>;
  const params: (string | number)[] = [];
  let where = '';
  if (userId) { where = 'WHERE c.userId = ?'; params.push(userId); }
  params.push(parseInt(limit));

  const [rows] = await pool.query(
    `SELECT c.*, u.name as userName FROM chat_messages c LEFT JOIN users u ON u.id = c.userId
     ${where} ORDER BY c.created_at DESC LIMIT ?`,
    params
  ) as [ChatMessage[], unknown];
  res.json(rows);
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
  const [users] = await pool.query('SELECT id FROM users') as [{ id: number }[], unknown];
  await Promise.all(users.map(u => createNotification(u.id, type || 'info', category || 'system', message)));
  res.json({ success: true, sent: users.length });
}));

adminRouter.get('/notifications', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { limit = '50' } = req.query as Record<string, string>;
  const [rows] = await pool.query(
    `SELECT n.*, u.name as userName FROM notifications n LEFT JOIN users u ON u.id = n.userId
     ORDER BY n.created_at DESC LIMIT ?`,
    [parseInt(limit)]
  ) as [NotificationRow[], unknown];
  res.json(rows);
}));

// ─────────────────────────────────────────────────────────────────────────
// Documents — l'admin envoie un document à un utilisateur (table `documents`,
// déjà utilisée côté client dans DocumentsPage)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.post('/documents/send', upload.single('file'), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, type, expiresAt }: { userId: number; type?: DocumentType; expiresAt?: string } = req.body;
  if (!userId) throw new ValidationError('userId requis');
  if (!req.file) throw new ValidationError('Fichier requis');

  const filePath = `/uploads/documents/${req.file.filename}`;

  const [result] = await pool.query(
    'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at, sent_by_admin) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [userId, type || 'other', filePath, req.file.size, req.file.mimetype, expiresAt || null]
  ) as [{ insertId: number }, unknown];

  await createNotification(userId, 'info', 'document', `Un nouveau document (${type || 'autre'}) a été ajouté par l'agence`);

  const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [result.insertId]) as [DocumentRow[], unknown];
  res.status(201).json(rows[0]);
}));

adminRouter.get('/documents', asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId, limit = '50' } = req.query as Record<string, string>;
  const params: (string | number)[] = [];
  let where = '';
  if (userId) { where = 'WHERE d.userId = ?'; params.push(userId); }
  params.push(parseInt(limit));

  const [rows] = await pool.query(
    `SELECT d.*, u.name as userName FROM documents d LEFT JOIN users u ON u.id = d.userId
     ${where} ORDER BY d.created_at DESC LIMIT ?`,
    params
  ) as [DocumentRow[], unknown];
  res.json(rows);
}));

adminRouter.delete('/documents/:id', asyncHandler(async (req: AdminRequest, res: Response) => {
  await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────
// Administrateurs (réservé aux superadmins)
// ─────────────────────────────────────────────────────────────────────────

adminRouter.get('/admins', asyncHandler(async (req: AdminRequest, res: Response) => {
  requireSuperadmin(req);
  const [rows] = await pool.query(
    'SELECT id, username, email, role, created_at FROM admins ORDER BY created_at DESC'
  ) as [Admin[], unknown];
  res.json(rows);
}));

adminRouter.post('/admins', asyncHandler(async (req: AdminRequest, res: Response) => {
  requireSuperadmin(req);
  const { username, email, password, role }: {
    username: string; email: string; password: string; role?: AdminRole;
  } = req.body;

  const hash = await bcrypt.hash(password, 12);
  try {
    const [result] = await pool.query(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, role || 'admin']
    ) as [{ insertId: number }, unknown];
    res.status(201).json({ id: result.insertId, username, email, role: role || 'admin' });
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
  await pool.query('DELETE FROM admins WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));
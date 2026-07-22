import { Router, Response } from 'express';
import { adminGuard, AdminRequest } from '../middleware/adminGuard';
import { pool } from '../config/db';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { createNotification } from './notifications';

const upload = multer({ dest: path.join(__dirname, '../../uploads/documents') });

export const adminRouter = Router();
adminRouter.use(adminGuard);

// Fusionne deux séries mensuelles (ex: appointments + tickets) sur une clé "month" commune
function mergeMonthlySeries(rowsA: any[], rowsB: any[], keyA: string, keyB: string) {
  const map: Record<string, any> = {};
  rowsA.forEach((r: any) => { map[r.month] = { month: r.month, [keyA]: r.count, [keyB]: 0 }; });
  rowsB.forEach((r: any) => {
    if (!map[r.month]) map[r.month] = { month: r.month, [keyA]: 0, [keyB]: 0 };
    map[r.month][keyB] = r.count;
  });
  return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month));
}

// Stats globales
adminRouter.get('/stats', async (_req: AdminRequest, res: Response) => {
  try {
    const [[{ totalUsers }]]: any = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalAppointments }]]: any = await pool.query('SELECT COUNT(*) as totalAppointments FROM appointments');
    const [[{ totalTickets }]]: any = await pool.query('SELECT COUNT(*) as totalTickets FROM tickets');
    const [[{ totalDocuments }]]: any = await pool.query('SELECT COUNT(*) as totalDocuments FROM documents');
    const [[{ upcomingAppointments }]]: any = await pool.query("SELECT COUNT(*) as upcomingAppointments FROM appointments WHERE status='upcoming'");
    const [[{ upcomingTickets }]]: any = await pool.query("SELECT COUNT(*) as upcomingTickets FROM tickets WHERE status='upcoming'");
    const [recentActivity]: any = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count, 'appointment' as type FROM appointments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
      UNION ALL
      SELECT DATE(created_at), COUNT(*), 'ticket' FROM tickets
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // ── Graphiques : réservations par mois (RDV + billets), 6 derniers mois ──
    const [apptByMonth]: any = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM appointments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`);
    const [ticketsByMonth]: any = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM tickets
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`);
    const bookingsByMonth = mergeMonthlySeries(apptByMonth, ticketsByMonth, 'appointments', 'tickets');

    // ── Nouveaux utilisateurs par mois, 6 derniers mois ──
    const [newUsersByMonth]: any = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`);

    // ── Destinations les plus réservées ──
    const [topDestinations]: any = await pool.query(`
      SELECT destination, COUNT(*) as count FROM tickets
      WHERE destination IS NOT NULL AND destination != ''
      GROUP BY destination ORDER BY count DESC LIMIT 5`);

    // ── Assistant IA : volume de conversations + taux de conversion ──
    const [[{ totalIAMessages }]]: any = await pool.query('SELECT COUNT(*) as totalIAMessages FROM chat_messages');
    const [[{ totalIAUsers }]]: any = await pool.query('SELECT COUNT(DISTINCT userId) as totalIAUsers FROM chat_messages');
    const [[{ iaConversationsToday }]]: any = await pool.query(
      "SELECT COUNT(*) as iaConversationsToday FROM chat_messages WHERE role='assistant' AND DATE(created_at) = CURDATE()"
    );
    const [[{ usersWithTicket }]]: any = await pool.query('SELECT COUNT(DISTINCT userId) as usersWithTicket FROM tickets');
    const conversionRate = totalIAUsers > 0 ? Math.round((usersWithTicket / totalIAUsers) * 1000) / 10 : 0;

    res.json({
      totalUsers, totalAppointments, totalTickets, totalDocuments,
      upcomingAppointments, upcomingTickets, recentActivity,
      bookingsByMonth, newUsersByMonth, topDestinations,
      ia: { totalMessages: totalIAMessages, totalUsers: totalIAUsers, conversationsToday: iaConversationsToday, conversionRate },
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Utilisateurs
adminRouter.get('/users', async (req: AdminRequest, res: Response) => {
  try {
    const { search = '', page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const like = `%${search}%`;
    const [users] = await pool.query(
      `SELECT u.*, COUNT(DISTINCT a.id) as appointmentCount, COUNT(DISTINCT t.id) as ticketCount
       FROM users u LEFT JOIN appointments a ON a.userId = u.id LEFT JOIN tickets t ON t.userId = u.id
       WHERE u.name LIKE ? OR u.email LIKE ?
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [like, like, parseInt(limit), offset]
    );
    const [[{ total }]]: any = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE name LIKE ? OR email LIKE ?', [like, like]
    );
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.get('/users/:id', async (req: AdminRequest, res: Response) => {
  try {
    const [user]: any = await pool.query('SELECT id, name, email, avatar, phone, blocked, created_at FROM users WHERE id = ?', [req.params.id]);
    const [appointments] = await pool.query('SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime DESC LIMIT 10', [req.params.id]);
    const [tickets] = await pool.query('SELECT * FROM tickets WHERE userId = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    const [documents] = await pool.query('SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ user: user[0], appointments, tickets, documents });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.delete('/users/:id', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Modifier un utilisateur (nom, téléphone, email)
adminRouter.put('/users/:id', async (req: AdminRequest, res: Response) => {
  try {
    const { name, phone, email } = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    if (name  !== undefined) { fields.push('name = ?');  params.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (!fields.length) return res.status(400).json({ message: 'Aucun champ à modifier' });
    params.push(req.params.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    const [rows]: any = await pool.query('SELECT id, name, email, phone, avatar, blocked, created_at FROM users WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email déjà utilisé' });
    res.status(500).json({ message: err.message });
  }
});

// Bloquer / débloquer un utilisateur (empêche la connexion — voir authGuard/login)
adminRouter.put('/users/:id/block', async (req: AdminRequest, res: Response) => {
  try {
    const { blocked } = req.body;
    await pool.query('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, req.params.id]);
    res.json({ success: true, blocked: !!blocked });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Rendez-vous
adminRouter.get('/appointments', async (req: AdminRequest, res: Response) => {
  try {
    const { status, limit = '50', from, to } = req.query as any;
    const params: any[] = [];
    const conditions: string[] = [];
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (from)   { conditions.push('a.dateTime >= ?'); params.push(from); }
    if (to)     { conditions.push('a.dateTime <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit));
    const [rows] = await pool.query(
      `SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId ${where} ORDER BY a.dateTime ASC LIMIT ?`,
      params
    );
    const countParams = conditions.length ? params.slice(0, -1) : [];
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a ${where}`,
      countParams
    );
    res.json({ appointments: rows, total });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.delete('/appointments/:id', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// Liste d'attente — lecture pour l'admin (table `waitlist`, alimentée côté
// client par joinWaitlist dans appointments.ts). Le rang est recalculé par
// jour, comme côté client (getMyWaitlistPosition).
// ─────────────────────────────────────────────────────────────────────────
adminRouter.get('/waitlist', async (req: AdminRequest, res: Response) => {
  try {
    const { date, from, to } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (date) { where = 'WHERE date = ?'; params.push(date); }
    else if (from && to) { where = 'WHERE date BETWEEN ? AND ?'; params.push(from, to); }
    const [rows]: any = await pool.query(
      `SELECT id, userId, name, date, quantity, created_at FROM waitlist ${where} ORDER BY date ASC, created_at ASC`,
      params
    );
    // Rang recalculé par jour (1 = premier inscrit de la journée)
    const countsByDate: Record<string, number> = {};
    const withRank = rows.map((w: any) => {
      const key = String(w.date);
      countsByDate[key] = (countsByDate[key] || 0) + 1;
      return { ...w, rank: countsByDate[key] };
    });
    const totalsByDate: Record<string, number> = {};
    withRank.forEach((w: any) => { totalsByDate[String(w.date)] = (totalsByDate[String(w.date)] || 0) + 1; });
    const result = withRank.map((w: any) => ({ ...w, total: totalsByDate[String(w.date)] }));

    res.json(result);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.delete('/waitlist/:id', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM waitlist WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Modifier un rendez-vous (titre, description, date/heure, lieu, statut)
adminRouter.put('/appointments/:id', async (req: AdminRequest, res: Response) => {
  try {
    const { title, description, dateTime, location, status } = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    if (title       !== undefined) { fields.push('title = ?');       params.push(title); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (dateTime    !== undefined) { fields.push('dateTime = ?');    params.push(dateTime); }
    if (location    !== undefined) { fields.push('location = ?');    params.push(location); }
    if (status      !== undefined) { fields.push('status = ?');      params.push(status); }
    if (!fields.length) return res.status(400).json({ message: 'Aucun champ à modifier' });
    params.push(req.params.id);
    await pool.query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, params);
    const [rows]: any = await pool.query(
      'SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId WHERE a.id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Bloquer un rendez-vous (raccourci : passe le statut à "cancelled")
adminRouter.put('/appointments/:id/block', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Tickets
adminRouter.get('/tickets', async (req: AdminRequest, res: Response) => {
  try {
    const { status, limit = '50' } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (status) { where = 'WHERE t.status = ?'; params.push(status); }
    params.push(parseInt(limit));
    const [rows] = await pool.query(
      `SELECT t.*, u.name as userName FROM tickets t LEFT JOIN users u ON u.id = t.userId ${where} ORDER BY t.created_at DESC LIMIT ?`,
      params
    );
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) as total FROM tickets${status ? ' WHERE status = ?' : ''}`,
      status ? [status] : []
    );
    res.json({ tickets: rows, total });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.delete('/tickets/:id', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM tickets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// Conversations IA — lecture seule, pour supervision (table chat_messages,
// déjà alimentée par voice.ts, jamais exposée côté admin jusqu'ici)
// ─────────────────────────────────────────────────────────────────────────
adminRouter.get('/conversations', async (req: AdminRequest, res: Response) => {
  try {
    const { userId, limit = '50' } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (userId) { where = 'WHERE c.userId = ?'; params.push(userId); }
    params.push(parseInt(limit));
    const [rows] = await pool.query(
      `SELECT c.*, u.name as userName FROM chat_messages c LEFT JOIN users u ON u.id = c.userId
       ${where} ORDER BY c.created_at DESC LIMIT ?`,
      params
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// Notifications — envoi ciblé ou broadcast depuis l'admin, réutilise le
// système de notifications déjà en place (createNotification)
// ─────────────────────────────────────────────────────────────────────────
adminRouter.post('/notifications/send', async (req: AdminRequest, res: Response) => {
  try {
    const { target, userId, type, category, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message requis' });

    if (target === 'user') {
      if (!userId) return res.status(400).json({ message: 'userId requis pour un envoi ciblé' });
      await createNotification(userId, type || 'info', category || 'system', message);
      return res.json({ success: true, sent: 1 });
    }

    // Broadcast à tous les utilisateurs
    const [users]: any = await pool.query('SELECT id FROM users');
    await Promise.all(users.map((u: any) => createNotification(u.id, type || 'info', category || 'system', message)));
    res.json({ success: true, sent: users.length });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.get('/notifications', async (req: AdminRequest, res: Response) => {
  try {
    const { limit = '50' } = req.query as any;
    const [rows] = await pool.query(
      `SELECT n.*, u.name as userName FROM notifications n LEFT JOIN users u ON u.id = n.userId
       ORDER BY n.created_at DESC LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// Documents — l'admin envoie un document à un utilisateur (table `documents`,
// déjà utilisée côté client dans DocumentsPage)
// ─────────────────────────────────────────────────────────────────────────
adminRouter.post('/documents/send', upload.single('file'), async (req: AdminRequest, res: Response) => {
  try {
    const { userId, type, expiresAt } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId requis' });
    if (!req.file) return res.status(400).json({ message: 'Fichier requis' });

    const filePath = `/uploads/documents/${req.file.filename}`;

    const [result]: any = await pool.query(
      'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at, sent_by_admin) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [userId, type || 'other', filePath, req.file.size, req.file.mimetype, expiresAt || null]
    );

    await createNotification(userId, 'info', 'document', `Un nouveau document (${type || 'autre'}) a été ajouté par l'agence`);

    const [rows]: any = await pool.query('SELECT * FROM documents WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.get('/documents', async (req: AdminRequest, res: Response) => {
  try {
    const { userId, limit = '50' } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (userId) { where = 'WHERE d.userId = ?'; params.push(userId); }
    params.push(parseInt(limit));
    const [rows] = await pool.query(
      `SELECT d.*, u.name as userName FROM documents d LEFT JOIN users u ON u.id = d.userId
       ${where} ORDER BY d.created_at DESC LIMIT ?`,
      params
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.delete('/documents/:id', async (req: AdminRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// Admins (superadmin only)
adminRouter.get('/admins', async (req: AdminRequest, res: Response) => {
  try {
    if (req.admin!.role !== 'superadmin') return res.status(403).json({ message: 'Accès refusé' });
    const [rows] = await pool.query('SELECT id, username, email, role, created_at FROM admins ORDER BY created_at DESC');
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

adminRouter.post('/admins', async (req: AdminRequest, res: Response) => {
  try {
    if (req.admin!.role !== 'superadmin') return res.status(403).json({ message: 'Accès refusé' });
    const { username, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const [result]: any = await pool.query(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, role || 'admin']
    );
    res.status(201).json({ id: result.insertId, username, email, role: role || 'admin' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username ou email déjà utilisé' });
    res.status(500).json({ message: err.message });
  }
});

adminRouter.delete('/admins/:id', async (req: AdminRequest, res: Response) => {
  try {
    if (req.admin!.role !== 'superadmin') return res.status(403).json({ message: 'Accès refusé' });
    if (parseInt(req.params.id) === req.admin!.id) return res.status(400).json({ message: 'Impossible de supprimer votre propre compte' });
    await pool.query('DELETE FROM admins WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
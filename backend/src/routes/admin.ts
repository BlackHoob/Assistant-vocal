import { Router, Response } from 'express';
import { adminGuard, AdminRequest } from '../middleware/adminGuard';
import { pool } from '../config/db';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();
adminRouter.use(adminGuard);

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
    res.json({ totalUsers, totalAppointments, totalTickets, totalDocuments, upcomingAppointments, upcomingTickets, recentActivity });
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
    const [user]: any = await pool.query('SELECT id, name, email, avatar, phone, created_at FROM users WHERE id = ?', [req.params.id]);
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

// Rendez-vous
adminRouter.get('/appointments', async (req: AdminRequest, res: Response) => {
  try {
    const { status, limit = '50' } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (status) { where = 'WHERE a.status = ?'; params.push(status); }
    params.push(parseInt(limit));
    const [rows] = await pool.query(
      `SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId ${where} ORDER BY a.dateTime DESC LIMIT ?`,
      params
    );
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) as total FROM appointments${status ? ' WHERE status = ?' : ''}`,
      status ? [status] : []
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
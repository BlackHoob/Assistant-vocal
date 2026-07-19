import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import { createNotification } from './notifications';

export const appointmentsRouter = Router();
appointmentsRouter.use(authGuard);

// ─────────────────────────────────────────────────────────────────────────
// Fonctions métier réutilisables : appelées par les routes HTTP ci-dessous
// ET par les outils IA de voice.ts (function calling). Une seule source de
// vérité, pas d'appel HTTP interne.
// ─────────────────────────────────────────────────────────────────────────

export async function getAppointments(userId: number) {
  const [rows]: any = await pool.query(
    'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime ASC',
    [userId]
  );
  return rows;
}

export async function getTakenSlots(date: string) {
  const [rows]: any = await pool.query(
    `SELECT dateTime FROM appointments WHERE DATE(dateTime) = ? AND status = 'upcoming'`,
    [date]
  );
  return rows.map((r: any) => {
    const dt = new Date(r.dateTime);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  });
}

export async function createAppointment(userId: number, data: {
  title: string; description?: string; dateTime: string; quantity?: number; agent?: string;
}) {
  const { title, dateTime } = data;
  if (!title || !dateTime) {
    const e: any = new Error('Titre et date requis'); e.code = 'MISSING_FIELDS'; throw e;
  }

  const [existing]: any = await pool.query(
    `SELECT id FROM appointments WHERE dateTime = ? AND status = 'upcoming'`,
    [dateTime]
  );
  if (existing.length > 0) {
    const e: any = new Error('Ce créneau est déjà réservé.'); e.code = 'SLOT_TAKEN'; throw e;
  }

  const [result]: any = await pool.query(
    'INSERT INTO appointments (userId, title, description, dateTime, agent, quantity) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, title, data.description || '', dateTime, data.agent || '', data.quantity || 1]
  );
  const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]);
  const appointment = rows[0];

  const dt = new Date(dateTime);
  const dateLabel = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  await createNotification(userId, 'success', 'appointment', `Rendez-vous "${title}" confirmé le ${dateLabel} à ${timeLabel}`);

  return appointment;
}

export async function updateAppointment(userId: number, id: string, data: {
  title?: string; description?: string; dateTime?: string; location?: string; quantity?: number; status?: string;
}) {
  const { title, description, dateTime, location, quantity, status } = data;

  if (dateTime && status !== 'cancelled') {
    const [existing]: any = await pool.query(
      `SELECT id FROM appointments WHERE dateTime = ? AND status = 'upcoming' AND id != ?`,
      [dateTime, id]
    );
    if (existing.length > 0) {
      const e: any = new Error('Ce créneau est déjà réservé.'); e.code = 'SLOT_TAKEN'; throw e;
    }
  }

  await pool.query(
    'UPDATE appointments SET title=?, description=?, dateTime=?, location=?, quantity=?, status=? WHERE id=? AND userId=?',
    [title, description, dateTime, location, quantity || 1, status || 'upcoming', id, userId]
  );
  const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
  const appointment = rows[0];

  if (status === 'cancelled') {
    await createNotification(userId, 'info', 'appointment', `Rendez-vous "${appointment?.title || title}" annulé`);
  } else if (status === 'completed') {
    await createNotification(userId, 'success', 'appointment', `Rendez-vous "${appointment?.title || title}" marqué terminé`);
  }

  return appointment;
}

// Annulation "douce" utilisée par l'IA : passe le statut à cancelled plutôt
// que de supprimer la ligne, pour garder un historique consultable.
export async function cancelAppointment(userId: number, id: string) {
  const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ? AND userId = ?', [id, userId]);
  if (!rows.length) {
    const e: any = new Error('Rendez-vous introuvable'); e.code = 'NOT_FOUND'; throw e;
  }
  await pool.query(`UPDATE appointments SET status = 'cancelled' WHERE id = ? AND userId = ?`, [id, userId]);
  await createNotification(userId, 'info', 'appointment', `Rendez-vous "${rows[0].title}" annulé`);
  return { ...rows[0], status: 'cancelled' };
}

export async function deleteAppointment(userId: number, id: string) {
  await pool.query('DELETE FROM appointments WHERE id = ? AND userId = ?', [id, userId]);
}

export async function joinWaitlist(userId: number, data: { date: string; name: string; quantity?: number }) {
  const { date, name } = data;
  if (!date || !name) {
    const e: any = new Error('Date et nom requis'); e.code = 'MISSING_FIELDS'; throw e;
  }

  const [existing]: any = await pool.query('SELECT id FROM waitlist WHERE userId = ? AND date = ?', [userId, date]);
  if (existing.length > 0) {
    const e: any = new Error('Vous êtes déjà inscrit pour ce jour.'); e.code = 'ALREADY_LISTED'; throw e;
  }

  const [result]: any = await pool.query(
    'INSERT INTO waitlist (userId, name, date, quantity) VALUES (?, ?, ?, ?)',
    [userId, name, date, data.quantity || 1]
  );
  const [rankRow]: any = await pool.query(
    `SELECT COUNT(*) as \`rank\` FROM waitlist WHERE date = ? AND id <= ?`,
    [date, result.insertId]
  );
  const [rows]: any = await pool.query('SELECT * FROM waitlist WHERE id = ?', [result.insertId]);

  const dateLabel = new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  await createNotification(
    userId, 'success', 'appointment',
    `Inscription en liste d'attente confirmée pour le ${dateLabel} (position #${rankRow[0].rank})`
  );

  return { ...rows[0], rank: rankRow[0].rank };
}

export async function getMyWaitlistPosition(userId: number, date: string) {
  const [myEntry]: any = await pool.query('SELECT * FROM waitlist WHERE userId = ? AND date = ?', [userId, date]);
  if (!myEntry.length) return null;

  const [rankRow]: any = await pool.query(
    `SELECT COUNT(*) as \`rank\` FROM waitlist WHERE date = ? AND id <= ?`,
    [date, myEntry[0].id]
  );
  const [totalRow]: any = await pool.query('SELECT COUNT(*) as total FROM waitlist WHERE date = ?', [date]);

  return { ...myEntry[0], rank: rankRow[0].rank, total: totalRow[0].total };
}

export async function leaveWaitlist(userId: number, id: string) {
  await pool.query('DELETE FROM waitlist WHERE id = ? AND userId = ?', [id, userId]);
}

// ─────────────────────────────────────────────────────────────────────────
// Routes HTTP — appellent uniquement les fonctions ci-dessus
// ─────────────────────────────────────────────────────────────────────────

// GET /api/appointments
appointmentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try { res.json(await getAppointments(req.user!.id)); }
  catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /api/appointments/taken?date=YYYY-MM-DD
appointmentsRouter.get('/taken', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Paramètre date requis' });
    res.json({ takenSlots: await getTakenSlots(date as string) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/appointments
appointmentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const appointment = await createAppointment(req.user!.id, req.body);
    res.status(201).json(appointment);
  } catch (err: any) {
    console.error('APPOINTMENTS POST ERROR:', err);
    if (err.code === 'SLOT_TAKEN') return res.status(409).json({ message: err.message, code: err.code });
    if (err.code === 'MISSING_FIELDS') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/appointments/:id
appointmentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const appointment = await updateAppointment(req.user!.id, req.params.id, req.body);
    res.json(appointment);
  } catch (err: any) {
    if (err.code === 'SLOT_TAKEN') return res.status(409).json({ message: err.message, code: err.code });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/appointments/:id
appointmentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try { await deleteAppointment(req.user!.id, req.params.id); res.json({ success: true }); }
  catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── LISTE D'ATTENTE ─────────────────────────────────────────────────────

// GET /api/appointments/waitlist?date=YYYY-MM-DD
appointmentsRouter.get('/waitlist', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date requise' });
    const [rows]: any = await pool.query(
      `SELECT w.*, u.name as userName FROM waitlist w
       LEFT JOIN users u ON w.userId = u.id
       WHERE w.date = ? ORDER BY w.created_at ASC`,
      [date]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/appointments/waitlist
appointmentsRouter.post('/waitlist', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await joinWaitlist(req.user!.id, req.body);
    res.status(201).json(entry);
  } catch (err: any) {
    if (err.code === 'ALREADY_LISTED') return res.status(409).json({ message: err.message, code: err.code });
    if (err.code === 'MISSING_FIELDS') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// GET /api/appointments/waitlist/me?date=YYYY-MM-DD
appointmentsRouter.get('/waitlist/me', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date requise' });
    res.json(await getMyWaitlistPosition(req.user!.id, date as string));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/appointments/waitlist/:id
appointmentsRouter.delete('/waitlist/:id', async (req: AuthRequest, res: Response) => {
  try { await leaveWaitlist(req.user!.id, req.params.id); res.json({ success: true }); }
  catch (err: any) { res.status(500).json({ message: err.message }); }
});
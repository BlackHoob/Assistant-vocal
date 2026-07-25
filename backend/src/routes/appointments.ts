import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import { createNotification } from './notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, ConflictError, NotFoundError } from '../errors/AppError';
import { Appointment, AppointmentStatus, WaitlistEntry } from '../types';

export const appointmentsRouter = Router();
appointmentsRouter.use(authGuard);

// ─────────────────────────────────────────────────────────────────────────
// Fonctions métier réutilisables : appelées par les routes HTTP ci-dessous
// ET par les outils IA de voice.ts (function calling). Une seule source de
// vérité, pas d'appel HTTP interne.
// ─────────────────────────────────────────────────────────────────────────

export async function getAppointments(userId: number): Promise<Appointment[]> {
  const [rows] = await pool.query(
    'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime ASC', [userId]
  ) as [Appointment[], unknown];
  return rows;
}

export async function getTakenSlots(date: string): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT dateTime FROM appointments WHERE DATE(dateTime) = ? AND status = 'upcoming'`, [date]
  ) as [{ dateTime: string }[], unknown];

  return rows.map(({ dateTime }) => {
    const dt = new Date(dateTime);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  });
}

// Utilisée par createAppointment ET updateAppointment — avant le refactor,
// la même requête de vérification était copiée-collée dans les deux.
async function assertSlotAvailable(dateTime: string, excludeId?: string): Promise<void> {
  let query = `SELECT id FROM appointments WHERE dateTime = ? AND status = 'upcoming'`;
  const params: string[] = [dateTime];
  if (excludeId) { query += ' AND id != ?'; params.push(excludeId); }

  const [existing] = await pool.query(query, params) as [{ id: number }[], unknown];
  if (existing.length > 0) throw new ConflictError('Ce créneau est déjà réservé.', 'SLOT_TAKEN');
}

export async function createAppointment(userId: number, data: {
  title: string; description?: string; dateTime: string; quantity?: number; agent?: string;
}): Promise<Appointment> {
  const { title, dateTime } = data;
  if (!title || !dateTime) throw new ValidationError('Titre et date requis');

  await assertSlotAvailable(dateTime);

  const [result] = await pool.query(
    'INSERT INTO appointments (userId, title, description, dateTime, agent, quantity) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, title, data.description || '', dateTime, data.agent || '', data.quantity || 1]
  ) as [{ insertId: number }, unknown];

  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]) as [Appointment[], unknown];
  const appointment = rows[0];

  const dt = new Date(dateTime);
  const dateLabel = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  await createNotification(userId, 'success', 'appointment', `Rendez-vous "${title}" confirmé le ${dateLabel} à ${timeLabel}`);

  return appointment;
}

export async function updateAppointment(userId: number, id: string, data: {
  title?: string; description?: string; dateTime?: string; location?: string;
  quantity?: number; status?: AppointmentStatus;
}): Promise<Appointment> {
  const { title, description, dateTime, location, quantity, status } = data;

  if (dateTime && status !== 'cancelled') {
    await assertSlotAvailable(dateTime, id);
  }

  await pool.query(
    'UPDATE appointments SET title=?, description=?, dateTime=?, location=?, quantity=?, status=? WHERE id=? AND userId=?',
    [title, description, dateTime, location, quantity || 1, status || 'upcoming', id, userId]
  );

  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]) as [Appointment[], unknown];
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
export async function cancelAppointment(userId: number, id: string): Promise<Appointment> {
  const [rows] = await pool.query(
    'SELECT * FROM appointments WHERE id = ? AND userId = ?', [id, userId]
  ) as [Appointment[], unknown];
  if (!rows.length) throw new NotFoundError('Rendez-vous introuvable');

  await pool.query(`UPDATE appointments SET status = 'cancelled' WHERE id = ? AND userId = ?`, [id, userId]);
  await createNotification(userId, 'info', 'appointment', `Rendez-vous "${rows[0].title}" annulé`);
  return { ...rows[0], status: 'cancelled' };
}

export async function deleteAppointment(userId: number, id: string): Promise<void> {
  await pool.query('DELETE FROM appointments WHERE id = ? AND userId = ?', [id, userId]);
}

async function getWaitlistRank(date: string, entryId: number): Promise<number> {
  const [rankRow] = await pool.query(
    `SELECT COUNT(*) as \`rank\` FROM waitlist WHERE date = ? AND id <= ?`, [date, entryId]
  ) as [{ rank: number }[], unknown];
  return rankRow[0].rank;
}

export async function joinWaitlist(
  userId: number, data: { date: string; name: string; quantity?: number }
): Promise<WaitlistEntry> {
  const { date, name } = data;
  if (!date || !name) throw new ValidationError('Date et nom requis');

  const [existing] = await pool.query(
    'SELECT id FROM waitlist WHERE userId = ? AND date = ?', [userId, date]
  ) as [{ id: number }[], unknown];
  if (existing.length > 0) throw new ConflictError('Vous êtes déjà inscrit pour ce jour.', 'ALREADY_LISTED');

  const [result] = await pool.query(
    'INSERT INTO waitlist (userId, name, date, quantity) VALUES (?, ?, ?, ?)',
    [userId, name, date, data.quantity || 1]
  ) as [{ insertId: number }, unknown];

  const rank = await getWaitlistRank(date, result.insertId);
  const [rows] = await pool.query('SELECT * FROM waitlist WHERE id = ?', [result.insertId]) as [WaitlistEntry[], unknown];

  const dateLabel = new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  await createNotification(
    userId, 'success', 'appointment',
    `Inscription en liste d'attente confirmée pour le ${dateLabel} (position #${rank})`
  );

  return { ...rows[0], rank };
}

export async function getMyWaitlistPosition(userId: number, date: string): Promise<WaitlistEntry | null> {
  const [myEntry] = await pool.query(
    'SELECT * FROM waitlist WHERE userId = ? AND date = ?', [userId, date]
  ) as [WaitlistEntry[], unknown];
  if (!myEntry.length) return null;

  const rank = await getWaitlistRank(date, myEntry[0].id);
  const [totalRow] = await pool.query(
    'SELECT COUNT(*) as total FROM waitlist WHERE date = ?', [date]
  ) as [{ total: number }[], unknown];

  return { ...myEntry[0], rank, total: totalRow[0].total };
}

export async function leaveWaitlist(userId: number, id: string): Promise<void> {
  await pool.query('DELETE FROM waitlist WHERE id = ? AND userId = ?', [id, userId]);
}

// ─────────────────────────────────────────────────────────────────────────
// Routes HTTP — appellent uniquement les fonctions ci-dessus
// ─────────────────────────────────────────────────────────────────────────

appointmentsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await getAppointments(req.user!.id));
}));

appointmentsRouter.get('/taken', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  if (!date) throw new ValidationError('Paramètre date requis');
  res.json({ takenSlots: await getTakenSlots(date as string) });
}));

appointmentsRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const appointment = await createAppointment(req.user!.id, req.body);
  res.status(201).json(appointment);
}));

appointmentsRouter.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const appointment = await updateAppointment(req.user!.id, req.params.id, req.body);
  res.json(appointment);
}));

appointmentsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await deleteAppointment(req.user!.id, req.params.id);
  res.json({ success: true });
}));

// ─── LISTE D'ATTENTE ─────────────────────────────────────────────────────

appointmentsRouter.get('/waitlist', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  if (!date) throw new ValidationError('Date requise');
  const [rows] = await pool.query(
    `SELECT w.*, u.name as userName FROM waitlist w
     LEFT JOIN users u ON w.userId = u.id
     WHERE w.date = ? ORDER BY w.created_at ASC`,
    [date]
  ) as [WaitlistEntry[], unknown];
  res.json(rows);
}));

appointmentsRouter.post('/waitlist', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await joinWaitlist(req.user!.id, req.body);
  res.status(201).json(entry);
}));

appointmentsRouter.get('/waitlist/me', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  if (!date) throw new ValidationError('Date requise');
  res.json(await getMyWaitlistPosition(req.user!.id, date as string));
}));

appointmentsRouter.delete('/waitlist/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await leaveWaitlist(req.user!.id, req.params.id);
  res.json({ success: true });
}));

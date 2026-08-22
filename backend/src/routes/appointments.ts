import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { createNotification } from './notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, ConflictError, NotFoundError } from '../errors/AppError';
import { Appointment, AppointmentStatus, WaitlistEntry } from '../types';
import { MySqlAppointmentRepository } from '../repository/appointmentRepository';
import { MySqlWaitlistRepository } from '../repository/waitlistRepository';

export const appointmentsRouter = Router();
appointmentsRouter.use(authGuard);

const appointmentRepository = new MySqlAppointmentRepository();
const waitlistRepository = new MySqlWaitlistRepository();

// ─────────────────────────────────────────────────────────────────────────
// Fonctions métier réutilisables : appelées par les routes HTTP ci-dessous
// ET par les outils IA de voice.ts (function calling). Une seule source de
// vérité, pas d'appel HTTP interne.
// ─────────────────────────────────────────────────────────────────────────

export async function getAppointments(userId: number): Promise<Appointment[]> {
  return appointmentRepository.findAllByUser(userId);
}

export async function getTakenSlots(date: string): Promise<string[]> {
  const rows = await appointmentRepository.findTakenSlots(date);
  return rows.map(({ dateTime }) => {
    const dt = new Date(dateTime);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  });
}

async function assertSlotAvailable(dateTime: string, excludeId?: string): Promise<void> {
  if (await appointmentRepository.isSlotTaken(dateTime, excludeId)) {
    throw new ConflictError('Ce créneau est déjà réservé.', 'SLOT_TAKEN');
  }
}

export async function createAppointment(userId: number, data: {
  title: string; description?: string; dateTime: string; quantity?: number; agent?: string;
}): Promise<Appointment> {
  const { title, dateTime } = data;
  if (!title || !dateTime) throw new ValidationError('Titre et date requis');

  await assertSlotAvailable(dateTime);

  const appointment = await appointmentRepository.create(userId, data);

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
  const { title, dateTime, status } = data;

  if (dateTime && status !== 'cancelled') {
    await assertSlotAvailable(dateTime, id);
  }

  await appointmentRepository.update(id, userId, data);
  const appointment = await appointmentRepository.findById(id);

  if (status === 'cancelled') {
    await createNotification(userId, 'info', 'appointment', `Rendez-vous "${appointment?.title || title}" annulé`);
  } else if (status === 'completed') {
    await createNotification(userId, 'success', 'appointment', `Rendez-vous "${appointment?.title || title}" marqué terminé`);
  }

  return appointment!;
}

// Annulation "douce" utilisée par l'IA : passe le statut à cancelled plutôt
// que de supprimer la ligne, pour garder un historique consultable.
export async function cancelAppointment(userId: number, id: string): Promise<Appointment> {
  const appointment = await appointmentRepository.findByIdAndUser(id, userId);
  if (!appointment) throw new NotFoundError('Rendez-vous introuvable');

  await appointmentRepository.updateStatus(id, userId, 'cancelled');
  await createNotification(userId, 'info', 'appointment', `Rendez-vous "${appointment.title}" annulé`);
  return { ...appointment, status: 'cancelled' };
}

export async function deleteAppointment(userId: number, id: string): Promise<void> {
  await appointmentRepository.delete(id, userId);
}

export async function joinWaitlist(
  userId: number, data: { date: string; name: string; quantity?: number }
): Promise<WaitlistEntry> {
  const { date, name } = data;
  if (!date || !name) throw new ValidationError('Date et nom requis');

  const existing = await waitlistRepository.findByUserAndDate(userId, date);
  if (existing) throw new ConflictError('Vous êtes déjà inscrit pour ce jour.', 'ALREADY_LISTED');

  const entry = await waitlistRepository.create(userId, name, date, data.quantity || 1);
  const rank = await waitlistRepository.countUpToId(date, entry.id);

  const dateLabel = new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  await createNotification(
    userId, 'success', 'appointment',
    `Inscription en liste d'attente confirmée pour le ${dateLabel} (position #${rank})`
  );

  return { ...entry, rank };
}

export async function getMyWaitlistPosition(userId: number, date: string): Promise<WaitlistEntry | null> {
  const myEntry = await waitlistRepository.findByUserAndDate(userId, date);
  if (!myEntry) return null;

  const rank = await waitlistRepository.countUpToId(date, myEntry.id);
  const total = await waitlistRepository.countByDate(date);

  return { ...myEntry, rank, total };
}

export async function leaveWaitlist(userId: number, id: string): Promise<void> {
  await waitlistRepository.deleteByUser(id, userId);
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
  const rows = await waitlistRepository.findByDate(date as string);
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


import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const appointmentsRouter = Router();
appointmentsRouter.use(authGuard);

// GET /api/appointments — liste des RDV de l'utilisateur
appointmentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime ASC',
      [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /api/appointments/taken?date=YYYY-MM-DD — créneaux déjà pris ce jour
appointmentsRouter.get('/taken', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Paramètre date requis' });

    // Récupère tous les créneaux pris ce jour (tous utilisateurs, statut upcoming)
    const [rows]: any = await pool.query(
      `SELECT dateTime FROM appointments
       WHERE DATE(dateTime) = ? AND status = 'upcoming'`,
      [date]
    );

    // Extrait uniquement l'heure HH:MM
    const takenSlots = rows.map((r: any) => {
      const dt = new Date(r.dateTime);
      const h = String(dt.getHours()).padStart(2, '0');
      const m = String(dt.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    });

    res.json({ takenSlots });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/appointments — créer un RDV (vérifie le créneau)
appointmentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, dateTime, location } = req.body;
    if (!title || !dateTime) return res.status(400).json({ message: 'Titre et date requis' });

    // Vérification : créneau déjà pris par un autre utilisateur ?
    const [existing]: any = await pool.query(
      `SELECT id FROM appointments
       WHERE dateTime = ? AND status = 'upcoming'`,
      [dateTime]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Ce créneau est déjà réservé. Veuillez en choisir un autre.',
        code: 'SLOT_TAKEN'
      });
    }

    const [result]: any = await pool.query(
      'INSERT INTO appointments (userId, title, description, dateTime, location) VALUES (?, ?, ?, ?, ?)',
      [req.user!.id, title, description || '', dateTime, location || '']
    );
    const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// PUT /api/appointments/:id — modifier un RDV
appointmentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, dateTime, location, status } = req.body;

    // Si on change la date/heure, vérifier que le nouveau créneau est libre
    if (dateTime && status !== 'cancelled') {
      const [existing]: any = await pool.query(
        `SELECT id FROM appointments
         WHERE dateTime = ? AND status = 'upcoming' AND id != ?`,
        [dateTime, req.params.id]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          message: 'Ce créneau est déjà réservé. Veuillez en choisir un autre.',
          code: 'SLOT_TAKEN'
        });
      }
    }

    await pool.query(
      'UPDATE appointments SET title=?, description=?, dateTime=?, location=?, status=? WHERE id=? AND userId=?',
      [title, description, dateTime, location, status || 'upcoming', req.params.id, req.user!.id]
    );
    const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/appointments/:id
appointmentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM appointments WHERE id = ? AND userId = ?',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
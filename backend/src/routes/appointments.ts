import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const appointmentsRouter = Router();
appointmentsRouter.use(authGuard);

appointmentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime ASC', [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

appointmentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, dateTime, location } = req.body;
    if (!title || !dateTime) return res.status(400).json({ message: 'Titre et date requis' });
    const [result]: any = await pool.query(
      'INSERT INTO appointments (userId, title, description, dateTime, location) VALUES (?, ?, ?, ?, ?)',
      [req.user!.id, title, description || '', dateTime, location || '']
    );
    const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

appointmentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, dateTime, location, status } = req.body;
    await pool.query(
      'UPDATE appointments SET title=?, description=?, dateTime=?, location=?, status=? WHERE id=? AND userId=?',
      [title, description, dateTime, location, status || 'upcoming', req.params.id, req.user!.id]
    );
    const [rows]: any = await pool.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

appointmentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM appointments WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
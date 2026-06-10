 import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nestor_jwt_secret_change_this';
const JWT_EXPIRES = '7d';

const signToken = (user: any) =>
  jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const safeUser = (u: any) => ({
  id: u.id, name: u.name, email: u.email, avatar: u.avatar, phone: u.phone
});

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Mot de passe min. 8 caractères' });

    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(password, 12);
    const [result]: any = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ token: signToken(rows[0]), user: safeUser(rows[0]) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email et mot de passe requis' });

    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Identifiants invalides' });
    if (!user.password_hash)
      return res.status(401).json({ message: 'Ce compte utilise une autre méthode de connexion' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Identifiants invalides' });

    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Token manquant' });
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const [rows]: any = await pool.query(
      'SELECT id, name, email, avatar, phone FROM users WHERE id = ?', [decoded.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch { res.status(401).json({ message: 'Token invalide' }); }
});

export { JWT_SECRET };

// PUT /api/auth/change-password
import { authGuard, AuthRequest } from '../middleware/authGuard';
authRouter.put('/change-password', authGuard, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Nouveau mot de passe min. 8 caractères' });
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/db';
import { sendPasswordResetEmail } from './mailer';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError } from '../errors/AppError';
import { User, SafeUser } from '../types';

export const authRouter = Router();

export const JWT_SECRET = process.env.JWT_SECRET || 'nestor_jwt_secret_change_this';
const JWT_EXPIRES = '7d';
const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function signToken(user: Pick<User, 'id' | 'email' | 'name'>): string {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function toSafeUser(user: User): SafeUser {
  return { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone };
}

async function findUserByEmail(email: string): Promise<User | null> {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as [User[], unknown];
  return rows[0] ?? null;
}

async function findUserById(id: number): Promise<User | null> {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]) as [User[], unknown];
  return rows[0] ?? null;
}

// POST /api/auth/register
authRouter.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) throw new ValidationError('Tous les champs sont requis');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);

  if (await findUserByEmail(email)) throw new ConflictError('Cet email est déjà utilisé');

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash]
  ) as [{ insertId: number }, unknown];

  const user = await findUserById(result.insertId);
  res.status(201).json({ token: signToken(user!), user: toSafeUser(user!) });
}));

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) throw new ValidationError('Email et mot de passe requis');

  const user = await findUserByEmail(email);
  if (!user) throw new UnauthorizedError('Identifiants invalides');
  if (!user.password_hash) throw new UnauthorizedError('Ce compte utilise une autre méthode de connexion');
  // NOTE : ce contrôle n'existait pas avant le refactor — le blocage admin
  // (AdminUsersPage → "Bloquer") mettait bien `blocked = 1` en base, mais
  // rien ne l'empêchait de se reconnecter. Ajouté ici pour que la fonctionnalité
  // fasse réellement ce qu'elle promet.
  if (user.blocked) throw new UnauthorizedError('Ce compte a été bloqué par l\'agence');

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) throw new UnauthorizedError('Identifiants invalides');

  res.json({ token: signToken(user), user: toSafeUser(user) });
}));

// GET /api/auth/me
authRouter.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('Token manquant');

  let decoded: { id: number };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: number };
  } catch {
    throw new UnauthorizedError('Token invalide');
  }

  const user = await findUserById(decoded.id);
  if (!user) throw new NotFoundError('Utilisateur introuvable');
  res.json(toSafeUser(user));
}));

// PUT /api/auth/change-password
authRouter.put('/change-password', authGuard, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Nouveau mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);
  }

  const user = await findUserById(req.user!.id);
  const passwordValid = await bcrypt.compare(currentPassword, user!.password_hash!);
  if (!passwordValid) throw new UnauthorizedError('Mot de passe actuel incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.id]);
  res.json({ success: true });
}));

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) throw new ValidationError('Email requis');

  const user = await findUserByEmail(email);
  // Réponse identique que le compte existe ou non (anti-énumération de comptes).
  if (!user) return res.json({ success: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await pool.query(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
    [token, expires, user.id]
  );

  await sendPasswordResetEmail(email, `${FRONTEND_URL}/reset-password?token=${token}`);
  res.json({ success: true });
}));

// POST /api/auth/reset-password
authRouter.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) throw new ValidationError('Token et mot de passe requis');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Minimum ${MIN_PASSWORD_LENGTH} caractères`);

  const [rows] = await pool.query(
    'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]
  ) as [{ id: number }[], unknown];
  if (!rows.length) throw new ValidationError('Lien invalide ou expiré');

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [hash, rows[0].id]
  );
  res.json({ success: true });
}));

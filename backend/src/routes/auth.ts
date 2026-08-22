import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendPasswordResetEmail } from './mailer';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError } from '../errors/AppError';
import { User, SafeUser } from '../types';
import { MySqlUserRepository } from '../repository/userRepository';
import { getRequiredEnv } from '../utils/env';
import { authLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();
const userRepository = new MySqlUserRepository();

export const JWT_SECRET = getRequiredEnv('JWT_SECRET');
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

// POST /api/auth/register
authRouter.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) throw new ValidationError('Tous les champs sont requis');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);

  if (await userRepository.findByEmail(email)) throw new ConflictError('Cet email est déjà utilisé');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userRepository.create({ name, email, passwordHash });

  res.status(201).json({ token: signToken(user), user: toSafeUser(user) });
}));

// POST /api/auth/login
authRouter.post('/login', authLimiter,asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) throw new ValidationError('Email et mot de passe requis');

  const user = await userRepository.findByEmail(email);
  if (!user) throw new UnauthorizedError('Identifiants invalides');
  if (!user.password_hash) throw new UnauthorizedError('Ce compte utilise une autre méthode de connexion');
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

  const user = await userRepository.findById(decoded.id);
  if (!user) throw new NotFoundError('Utilisateur introuvable');
  res.json(toSafeUser(user));
}));

// PUT /api/auth/change-password
authRouter.put('/change-password', authGuard, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Nouveau mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);
  }

  const user = await userRepository.findById(req.user!.id);
  const passwordValid = await bcrypt.compare(currentPassword, user!.password_hash!);
  if (!passwordValid) throw new UnauthorizedError('Mot de passe actuel incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await userRepository.updatePasswordHash(req.user!.id, hash);
  res.json({ success: true });
}));

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', authLimiter,asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) throw new ValidationError('Email requis');

  const user = await userRepository.findByEmail(email);
  if (!user) return res.json({ success: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await userRepository.setResetToken(user.id, token, expires);

  await sendPasswordResetEmail(email, `${FRONTEND_URL}/reset-password?token=${token}`);
  res.json({ success: true });
}));

// POST /api/auth/reset-password
authRouter.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) throw new ValidationError('Token et mot de passe requis');
  if (password.length < MIN_PASSWORD_LENGTH) throw new ValidationError(`Minimum ${MIN_PASSWORD_LENGTH} caractères`);

  const user = await userRepository.findByResetToken(token);
  if (!user) throw new ValidationError('Lien invalide ou expiré');

  const hash = await bcrypt.hash(password, 12);
  await userRepository.resetPasswordWithToken(user.id, hash);
  res.json({ success: true });
}));

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, ValidationError } from '../errors/AppError';
import { Admin } from '../types';
import { MySqlAdminRepository } from '../repository/adminRepository';
import { getRequiredEnv } from '../utils/env';
import { createAuthLimiter } from '../middleware/rateLimiter';

export const adminAuthRouter = Router();
const adminRepository = new MySqlAdminRepository();

export const ADMIN_JWT_SECRET = getRequiredEnv('ADMIN_JWT_SECRET');
const ADMIN_TOKEN_EXPIRES = '8h';
const MIN_PASSWORD_LENGTH = 8;

// Limite plus stricte que celle des utilisateurs classiques (5 au lieu de
// 10 par 15 minutes) : un compte administrateur est une cible à plus fort
// enjeu, avec beaucoup moins de comptes légitimes susceptibles d'être
// bloqués par erreur.
const adminLoginLimiter = createAuthLimiter({ max: 5 });

function signAdminToken(admin: Pick<Admin, 'id' | 'username' | 'email' | 'role'>): string {
  return jwt.sign(
    { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRES }
  );
}

// POST /api/admin/auth/login
adminAuthRouter.post('/login', adminLoginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) throw new ValidationError('Identifiants requis');

  const admin = await adminRepository.findByUsernameOrEmail(username);
  if (!admin) throw new UnauthorizedError('Identifiants invalides');

  const passwordValid = await bcrypt.compare(password, admin.password_hash);
  if (!passwordValid) throw new UnauthorizedError('Identifiants invalides');

  await adminRepository.updateLastLogin(admin.id);

  res.json({
    token: signAdminToken(admin),
    admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
  });
}));

// POST /api/admin/auth/change-password
adminAuthRouter.post('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError();

  // Avant : jwt.verify() non protégé par un try/catch. Un token invalide
  // ou expiré levait une exception non reconnue comme AppError, renvoyant
  // un 500 générique au lieu d'un 401 — comportement incohérent avec le
  // reste de l'application (voir adminGuard.ts, qui applique déjà ce
  // même try/catch).
  let decoded: { id: number };
  try {
    decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { id: number };
  } catch {
    throw new UnauthorizedError('Token admin invalide ou expiré');
  }

  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);
  }

  const admin = await adminRepository.findById(decoded.id);
  if (!admin) throw new UnauthorizedError();

  const passwordValid = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!passwordValid) throw new UnauthorizedError('Mot de passe actuel incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await adminRepository.updatePasswordHash(decoded.id, hash);
  res.json({ success: true });
}));

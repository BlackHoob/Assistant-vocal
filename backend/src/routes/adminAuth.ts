import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, ValidationError } from '../errors/AppError';
import { Admin } from '../types';

export const adminAuthRouter = Router();

export const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_secret_change_this_in_production';
const ADMIN_TOKEN_EXPIRES = '8h';
const MIN_PASSWORD_LENGTH = 8;

function signAdminToken(admin: Pick<Admin, 'id' | 'username' | 'email' | 'role'>): string {
  return jwt.sign(
    { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRES }
  );
}

async function findAdminByCredentials(usernameOrEmail: string): Promise<Admin | null> {
  const [rows] = await pool.query(
    'SELECT * FROM admins WHERE username = ? OR email = ?',
    [usernameOrEmail, usernameOrEmail]
  ) as [Admin[], unknown];
  return rows[0] ?? null;
}

// POST /api/admin/auth/login
adminAuthRouter.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) throw new ValidationError('Identifiants requis');

  const admin = await findAdminByCredentials(username);
  if (!admin) throw new UnauthorizedError('Identifiants invalides');

  const passwordValid = await bcrypt.compare(password, admin.password_hash);
  if (!passwordValid) throw new UnauthorizedError('Identifiants invalides');

  await pool.query('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]).catch(() => {});

  res.json({
    token: signAdminToken(admin),
    admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
  });
}));

// POST /api/admin/auth/change-password
adminAuthRouter.post('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError();

  const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { id: number };
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Mot de passe min. ${MIN_PASSWORD_LENGTH} caractères`);
  }

  const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [decoded.id]) as [Admin[], unknown];
  const admin = rows[0];
  if (!admin) throw new UnauthorizedError();

  const passwordValid = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!passwordValid) throw new UnauthorizedError('Mot de passe actuel incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, decoded.id]);
  res.json({ success: true });
}));

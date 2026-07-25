import { Router, Response } from 'express';
import path from 'path';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { createUploadMiddleware, deleteUploadedFile } from '../utils/fileUpload';
import { ValidationError } from '../errors/AppError';
import { SafeUser } from '../types';

export const profileRouter = Router();
profileRouter.use(authGuard);

const AVATAR_FOLDER = 'avatars';
const MAX_AVATAR_SIZE_MB = 5;

const upload = createUploadMiddleware(
  AVATAR_FOLDER,
  originalName => `avatar-${Date.now()}${path.extname(originalName)}`,
  MAX_AVATAR_SIZE_MB
);

async function getSafeUserById(id: number): Promise<SafeUser> {
  const [rows] = await pool.query(
    'SELECT id, name, email, avatar, phone FROM users WHERE id = ?', [id]
  ) as [SafeUser[], unknown];
  return rows[0];
}

profileRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await getSafeUserById(req.user!.id));
}));

profileRouter.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, phone } = req.body as { name?: string; phone?: string };
  await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, req.user!.id]);
  res.json(await getSafeUserById(req.user!.id));
}));

profileRouter.post('/avatar', upload.single('avatar'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new ValidationError('Fichier requis');

  const [current] = await pool.query(
    'SELECT avatar FROM users WHERE id = ?', [req.user!.id]
  ) as [{ avatar: string | null }[], unknown];
  if (current[0]?.avatar) deleteUploadedFile(AVATAR_FOLDER, current[0].avatar);

  await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [req.file.filename, req.user!.id]);
  res.json({ avatar: req.file.filename, url: `/uploads/${AVATAR_FOLDER}/${req.file.filename}` });
}));

profileRouter.delete('/avatar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [current] = await pool.query(
    'SELECT avatar FROM users WHERE id = ?', [req.user!.id]
  ) as [{ avatar: string | null }[], unknown];
  if (current[0]?.avatar) deleteUploadedFile(AVATAR_FOLDER, current[0].avatar);

  await pool.query('UPDATE users SET avatar = NULL WHERE id = ?', [req.user!.id]);
  res.json({ message: 'Avatar supprimé' });
}));

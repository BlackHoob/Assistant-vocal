import { Router, Response } from 'express';
import path from 'path';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';
import { createUploadMiddleware, deleteUploadedFile } from '../utils/fileUpload';
import { ValidationError } from '../errors/AppError';
import { SafeUser } from '../types';
import { MySqlUserRepository } from '../repository/userRepository';
import { MySqlDocumentRepository } from '../repository/documentRepository';

export const profileRouter = Router();
profileRouter.use(authGuard);
const userRepository = new MySqlUserRepository();
const documentRepository = new MySqlDocumentRepository();

const AVATAR_FOLDER = 'avatars';
const MAX_AVATAR_SIZE_MB = 5;

const upload = createUploadMiddleware(
  AVATAR_FOLDER,
  originalName => `avatar-${Date.now()}${path.extname(originalName)}`,
  MAX_AVATAR_SIZE_MB
);

function toSafeUser(user: { id: number; name: string; email: string; avatar: string | null; phone: string | null }): SafeUser {
  return { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone };
}

profileRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepository.findById(req.user!.id);
  res.json(toSafeUser(user!));
}));

profileRouter.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, phone } = req.body as { name?: string; phone?: string };
  await userRepository.update(req.user!.id, { name, phone: phone || null });
  const user = await userRepository.findById(req.user!.id);
  res.json(toSafeUser(user!));
}));

profileRouter.post('/avatar', upload.single('avatar'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new ValidationError('Fichier requis');

  const current = await userRepository.findById(req.user!.id);
  if (current?.avatar) deleteUploadedFile(AVATAR_FOLDER, current.avatar);

  await userRepository.update(req.user!.id, { avatar: req.file.filename });
  res.json({ avatar: req.file.filename, url: `/uploads/${AVATAR_FOLDER}/${req.file.filename}` });
}));

profileRouter.delete('/avatar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const current = await userRepository.findById(req.user!.id);
  if (current?.avatar) deleteUploadedFile(AVATAR_FOLDER, current.avatar);

  await userRepository.update(req.user!.id, { avatar: null as any });
  res.json({ message: 'Avatar supprimé' });
}));

// DELETE /api/profile — droit à l'effacement (RGPD), en libre-service.
// Nettoie l'avatar et les documents physiques de l'utilisateur avant de
// supprimer son compte ; le ON DELETE CASCADE du schéma retire ensuite
// automatiquement le reste (rendez-vous, tickets, notifications,
// waitlist, messages IA). "Best effort" sur les fichiers : un fichier
// déjà absent du disque ne doit jamais empêcher la suppression du
// compte — même logique que la suppression admin et la purge des
// documents expirés.
profileRouter.delete('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [user, documents] = await Promise.all([
    userRepository.findById(req.user!.id),
    documentRepository.findByUser(req.user!.id),
  ]);

  if (user?.avatar) {
    try {
      deleteUploadedFile(AVATAR_FOLDER, user.avatar);
    } catch (err) {
      console.error(`Avatar déjà absent ou inaccessible : ${user.avatar}`, err);
    }
  }

  for (const document of documents) {
    try {
      deleteUploadedFile('documents', path.basename(document.file_path));
    } catch (err) {
      console.error(`Fichier déjà absent ou inaccessible : ${document.file_path}`, err);
    }
  }

  await userRepository.deleteById(String(req.user!.id));
  res.json({ success: true });
}));
import { Router, Response } from 'express';
import path from 'path';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { createUploadMiddleware, deleteUploadedFile } from '../utils/fileUpload';
import { ValidationError, NotFoundError } from '../errors/AppError';
import { DocumentRow } from '../types';

export const documentsRouter = Router();
documentsRouter.use(authGuard);

const DOCUMENTS_FOLDER = 'documents';
const MAX_DOCUMENT_SIZE_MB = 20;

const upload = createUploadMiddleware(
  DOCUMENTS_FOLDER,
  originalName => `${Date.now()}-${originalName}`,
  MAX_DOCUMENT_SIZE_MB
);

documentsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.query(
    'SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [req.user!.id]
  ) as [DocumentRow[], unknown];
  res.json(rows);
}));

documentsRouter.post('/upload', upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new ValidationError('Fichier requis');
  const { name, expires_at } = req.body as { name?: string; expires_at?: string };

  // NOTE : avant le refactor, cette route stockait uniquement le nom de
  // fichier brut dans `file_path` (ex: "1721-photo.pdf"), alors que la
  // route admin équivalente (admin.ts, envoi de document par l'agence)
  // stocke le chemin complet ("/uploads/documents/1721-photo.pdf"). Cette
  // incohérence cassait l'aperçu/téléchargement des documents envoyés par
  // le client (fileUrl() côté frontend suppose toujours ce préfixe).
  // Corrigé pour utiliser la même convention des deux côtés.
  const filePath = `/uploads/documents/${req.file.filename}`;

  const [result] = await pool.query(
    'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user!.id, name || req.file.originalname, filePath, req.file.size, req.file.mimetype, expires_at || null]
  ) as [{ insertId: number }, unknown];

  const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [result.insertId]) as [DocumentRow[], unknown];
  res.status(201).json(rows[0]);
}));

documentsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.query(
    'SELECT * FROM documents WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]
  ) as [DocumentRow[], unknown];
  const document = rows[0];
  if (!document) throw new NotFoundError('Document introuvable');

  deleteUploadedFile(DOCUMENTS_FOLDER, path.basename(document.file_path));
  await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

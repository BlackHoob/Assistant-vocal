import { Router, Response } from 'express';
import path from 'path';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../errors/AppError';
import { MySqlDocumentRepository } from '../repository/documentRepository';

import { createUploadMiddleware, deleteUploadedFile } from '../utils/fileUpload';

export const documentsRouter = Router();
documentsRouter.use(authGuard);

const DOCUMENTS_FOLDER = 'documents';
const MAX_DOCUMENT_SIZE_MB = 20;
const documentRepository = new MySqlDocumentRepository();

const upload = createUploadMiddleware(
  DOCUMENTS_FOLDER,
  originalName => `${Date.now()}-${originalName}`,
  MAX_DOCUMENT_SIZE_MB
);

documentsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const rows = await documentRepository.findAllByUser(req.user!.id);
  res.json(rows);
}));

documentsRouter.post('/upload', upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new ValidationError('Fichier requis');
  const { name, expires_at } = req.body as { name?: string; expires_at?: string };
  const document = await documentRepository.create({
    userId: req.user!.id,
    name: name || req.file.originalname,
    filePath: `/uploads/documents/${req.file.filename}`,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    expiresAt: expires_at || null,
  });

  res.status(201).json(document);
}));

documentsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const document = await documentRepository.findById(req.params.id, req.user!.id);
  if (!document) throw new NotFoundError('Document introuvable');

  deleteUploadedFile(DOCUMENTS_FOLDER, path.basename(document.file_path));
  await documentRepository.delete(document.id);
  res.json({ success: true });
}));



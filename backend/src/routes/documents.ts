import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const documentsRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

documentsRouter.use(authGuard);

documentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

documentsRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier requis' });
    const { name, expires_at } = req.body;
    const [result]: any = await pool.query(
      'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user!.id, name || req.file.originalname, req.file.filename,
       req.file.size, req.file.mimetype, expires_at || null]
    );
    const [rows]: any = await pool.query('SELECT * FROM documents WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

documentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Document introuvable' });
    const filePath = path.join(__dirname, '../../uploads/documents', rows[0].file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
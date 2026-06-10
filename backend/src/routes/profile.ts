import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';

export const profileRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

profileRouter.use(authGuard);

profileRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT id, name, email, avatar, phone FROM users WHERE id = ?', [req.user!.id]
    );
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

profileRouter.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone } = req.body;
    await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone || null, req.user!.id]);
    const [rows]: any = await pool.query(
      'SELECT id, name, email, avatar, phone FROM users WHERE id = ?', [req.user!.id]
    );
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

profileRouter.post('/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier requis' });
    const [old]: any = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.user!.id]);
    if (old[0]?.avatar) {
      const oldPath = path.join(__dirname, '../../uploads/avatars', old[0].avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [req.file.filename, req.user!.id]);
    res.json({ avatar: req.file.filename, url: `/uploads/avatars/${req.file.filename}` });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

export const adminAuthRouter = Router();

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin_secret_change_this_in_production';

const signAdminToken = (admin: any) =>
  jwt.sign(
    { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  );

// POST /api/admin/auth/login
adminAuthRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Identifiants requis' });
    }

    const [rows]: any = await pool.query(
      'SELECT * FROM admins WHERE username = ? OR email = ?',
      [username, username]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ message: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ message: 'Identifiants invalides' });

    // Log connexion
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]).catch(() => {});

    res.json({
      token: signAdminToken(admin),
      admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/auth/change-password
adminAuthRouter.post('/change-password', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Non autorisé' });

    const decoded: any = jwt.verify(token, ADMIN_JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Mot de passe min. 8 caractères' });
    }

    const [rows]: any = await pool.query('SELECT * FROM admins WHERE id = ?', [decoded.id]);
    const admin = rows[0];
    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, decoded.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export { ADMIN_JWT_SECRET };
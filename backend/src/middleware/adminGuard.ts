import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET } from '../routes/adminAuth';

export interface AdminRequest extends Request {
  admin?: { id: number; username: string; email: string; role: string };
}

export const adminGuard = (req: AdminRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Accès administrateur requis' });

  try {
    const decoded: any = jwt.verify(token, ADMIN_JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token admin invalide ou expiré' });
  }
};
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET } from '../routes/adminAuth';
import { UnauthorizedError } from '../errors/AppError';
import { AdminRole } from '../types';

export interface AdminPayload {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
}

export interface AdminRequest extends Request {
  admin?: AdminPayload;
}

export function adminGuard(req: AdminRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new UnauthorizedError('Accès administrateur requis'));

  try {
    req.admin = jwt.verify(token, ADMIN_JWT_SECRET) as AdminPayload;
    next();
  } catch {
    next(new UnauthorizedError('Token admin invalide ou expiré'));
  }
}
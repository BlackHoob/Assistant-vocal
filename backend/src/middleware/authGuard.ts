import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth';
import { UnauthorizedError } from '../errors/AppError';

export interface UserPayload {
  id: number;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export function authGuard(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new UnauthorizedError('Token manquant'));

  try {
    req.user = jwt.verify(token, JWT_SECRET) as UserPayload;
    next();
  } catch {
    next(new UnauthorizedError('Token invalide ou expiré'));
  }
}
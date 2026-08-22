import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';


export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, code: err.code });
  }

  res.status(500).json({ message: 'Erreur interne du serveur' });
}

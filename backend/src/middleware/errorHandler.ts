import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Middleware d'erreur global Express. Toute erreur passée à next(err) par
// asyncHandler atterrit ici. À enregistrer APRÈS toutes les routes dans
// app.ts :
//
//   app.use('/api/auth', authRouter);
//   app.use('/api/admin', adminRouter);
//   // ... toutes les autres routes ...
//   app.use(errorHandler); 
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, code: err.code });
  }

  res.status(500).json({ message: 'Erreur interne du serveur' });
}
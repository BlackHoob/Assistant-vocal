import { Request, Response, NextFunction, RequestHandler } from 'express';

// Évite de répéter try { ... } catch (err: any) { res.status(500)... } dans
// chaque route : capture toute erreur (synchrone ou rejetée dans une
// Promise) et la transmet au middleware d'erreur global (errorHandler)
// via next(), au lieu de dupliquer la gestion d'erreur partout.

export const asyncHandler = <Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => (req, res, next) => {
  handler(req as Req, res, next).catch(next);
};
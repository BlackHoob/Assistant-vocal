import { Request, Response, NextFunction, RequestHandler } from 'express';


export const asyncHandler = <Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => (req, res, next) => {
  handler(req as Req, res, next).catch(next);
};
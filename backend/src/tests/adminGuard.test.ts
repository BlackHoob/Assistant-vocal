import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  adminGuard,
  AdminRequest,
  AdminPayload,
} from '../middleware/adminGuard';
import { ADMIN_JWT_SECRET } from '../routes/adminAuth';
import { UnauthorizedError } from '../errors/AppError';

describe('adminGuard', () => {
  let req: AdminRequest;
  let res: Response;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = {
      headers: {},
    } as AdminRequest;

    res = {} as Response;
    next = jest.fn();
  });

  it('doit retourner une erreur si le token admin est absent', () => {
    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty(
      'message',
      'Accès administrateur requis'
    );
  });

  it('doit retourner une erreur si le token admin est invalide', () => {
    req.headers.authorization = 'Bearer token-admin-invalide';

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty(
      'message',
      'Token admin invalide ou expiré'
    );
  });

  it('doit authentifier l’administrateur avec un token valide', () => {
  const admin: AdminPayload = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
  };

  const token = jwt.sign(admin, ADMIN_JWT_SECRET);

  req.headers.authorization = `Bearer ${token}`;

  adminGuard(req, res, next);

  expect(req.admin).toEqual(
    expect.objectContaining({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    })
  );

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith();
});
});
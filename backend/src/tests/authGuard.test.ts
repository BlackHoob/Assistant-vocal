import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authGuard, AuthRequest, UserPayload } from '../middleware/authGuard';
import { JWT_SECRET } from '../routes/auth';
import { UnauthorizedError } from '../errors/AppError';

describe('authGuard', () => {
  let req: AuthRequest;
  let res: Response;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = {
      headers: {},
    } as AuthRequest;

    res = {} as Response;
    next = jest.fn();
  });

  it('doit retourner une erreur si le token est absent', () => {
    authGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty('message', 'Token manquant');
  });

  it('doit retourner une erreur si le token est invalide', () => {
    req.headers.authorization = 'Bearer token-invalide';

    authGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty(
      'message',
      'Token invalide ou expiré'
    );
  });

  it('doit authentifier l’utilisateur avec un token valide', () => {
  const user: UserPayload = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
  };

  const token = jwt.sign(user, JWT_SECRET);

  req.headers.authorization = `Bearer ${token}`;

  authGuard(req, res, next);

  expect(req.user).toEqual(
    expect.objectContaining({
      id: user.id,
      email: user.email,
      name: user.name,
    })
  );

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith();
});
});
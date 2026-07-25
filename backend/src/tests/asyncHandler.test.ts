import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';

// Mocks minimalistes — pas besoin d'un vrai serveur Express pour tester
// qu'asyncHandler route correctement les erreurs vers next().
const mockReq = {} as Request;
const mockRes = {} as Response;

describe('asyncHandler', () => {
  it('exécute normalement un handler qui réussit, sans appeler next()', async () => {
    const next = jest.fn() as NextFunction;
    const handler = jest.fn().mockResolvedValue(undefined);

    await asyncHandler(handler)(mockReq, mockRes, next);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('transmet à next() une erreur levée dans une Promise rejetée', async () => {
    const next = jest.fn() as NextFunction;
    const error = new Error('Erreur base de données');
    const handler = jest.fn().mockRejectedValue(error);

    await asyncHandler(handler)(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('transmet à next() une AppError levée par le handler (cas nominal de nos routes)', async () => {
    const next = jest.fn() as NextFunction;
    class FakeAppError extends Error { statusCode = 409; code = 'SLOT_TAKEN'; }
    const error = new FakeAppError('Créneau déjà réservé');
    const handler = jest.fn().mockRejectedValue(error);

    await asyncHandler(handler)(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(error);
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(409);
  });

  it('ne laisse jamais une exception non gérée remonter (le catch est bien branché)', async () => {
    const next = jest.fn() as NextFunction;
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    // asyncHandler ne renvoie pas la Promise du handler (fire-and-forget,
    // pattern Express standard) — on vérifie donc que l'appel est
    // synchrone et ne lève rien, puis qu'après le microtask suivant,
    // next() a bien été appelé avec l'erreur.
    expect(() => asyncHandler(handler)(mockReq, mockRes, next)).not.toThrow();

    await new Promise(process.nextTick);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

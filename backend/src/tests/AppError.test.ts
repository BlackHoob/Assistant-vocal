import {
  AppError, ValidationError, UnauthorizedError,
  ForbiddenError, NotFoundError, ConflictError,
} from '../errors/AppError';

describe('AppError', () => {
  it('utilise 500 par défaut si aucun code n\'est précisé', () => {
    const err = new AppError('Erreur générique');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Erreur générique');
    expect(err.code).toBeUndefined();
  });

  it('accepte un code HTTP et un code métier personnalisés', () => {
    const err = new AppError('Créneau pris', 409, 'SLOT_TAKEN');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('SLOT_TAKEN');
  });

  it('reste une vraie instance de Error (stack trace utilisable)', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.stack).toBeDefined();
  });
});

describe('ValidationError', () => {
  it('renvoie toujours 400 avec le code MISSING_FIELDS', () => {
    const err = new ValidationError('Titre et date requis');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('MISSING_FIELDS');
    expect(err.message).toBe('Titre et date requis');
  });
});

describe('UnauthorizedError', () => {
  it('renvoie 401 avec un message par défaut si aucun n\'est fourni', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Non autorisé');
  });

  it('accepte un message personnalisé', () => {
    const err = new UnauthorizedError('Mot de passe actuel incorrect');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Mot de passe actuel incorrect');
  });
});

describe('ForbiddenError', () => {
  it('renvoie 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('NotFoundError', () => {
  it('renvoie 404 avec un message par défaut', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Ressource introuvable');
  });
});

describe('ConflictError', () => {
  it('renvoie 409 et accepte un code métier optionnel', () => {
    const err = new ConflictError('Vous êtes déjà inscrit pour ce jour.', 'ALREADY_LISTED');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('ALREADY_LISTED');
  });

  it('fonctionne aussi sans code métier', () => {
    const err = new ConflictError('Email déjà utilisé');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBeUndefined();
  });
});

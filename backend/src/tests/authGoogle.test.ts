import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { authGoogleRouter } from '../routes/authGoogle';
import { pool } from '../config/db';

/* -------------------------------------------------------------------------- */
/*                                   MOCKS                                    */
/* -------------------------------------------------------------------------- */

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

/* -------------------------------------------------------------------------- */
/*                                   MOCKED                                   */
/* -------------------------------------------------------------------------- */

const mockedPool = pool as jest.Mocked<typeof pool>;

/* -------------------------------------------------------------------------- */
/*                                    APP                                     */
/* -------------------------------------------------------------------------- */

const app = express();

app.use(express.json());

app.use('/api/auth', authGoogleRouter);

app.use(
  (
    err: Error & { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.statusCode ?? 500).json({
      error: err.message,
    });
  },
);

/* -------------------------------------------------------------------------- */
/*                                  TESTS                                     */
/* -------------------------------------------------------------------------- */

describe('POST /api/auth/google/exchange', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('doit refuser une requête sans code', async () => {
    const response = await request(app)
      .post('/api/auth/google/exchange')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Code requis');
    expect(mockedPool.query).not.toHaveBeenCalled();
  });

  it('doit refuser un code inconnu', async () => {
    // 1er appel : SELECT (aucune ligne trouvée)
    mockedPool.query.mockResolvedValueOnce([[], []] as never);
    // 2e appel : DELETE (toujours exécuté, même si rien à supprimer —
    // voir le commentaire dans googleAuthCodeRepository.ts)
    mockedPool.query.mockResolvedValueOnce([{}, []] as never);

    const response = await request(app)
      .post('/api/auth/google/exchange')
      .send({ code: 'code-inconnu' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Code invalide ou expiré');
    expect(mockedPool.query).toHaveBeenCalledTimes(2);
  });

  it('doit refuser un code expiré', async () => {
    const expired = new Date(Date.now() - 60_000); // expiré il y a 1 minute

    mockedPool.query
      .mockResolvedValueOnce([
        [{ user_id: 5, expires_at: expired }],
        [],
      ] as never)
      .mockResolvedValueOnce([{}, []] as never); // DELETE

    const response = await request(app)
      .post('/api/auth/google/exchange')
      .send({ code: 'code-expire' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Code invalide ou expiré');
  });

  it('doit échanger un code valide contre un token', async () => {
    const validExpiry = new Date(Date.now() + 30_000); // encore valide 30s

    mockedPool.query
      // 1er appel : SELECT du code
      .mockResolvedValueOnce([
        [{ user_id: 7, expires_at: validExpiry }],
        [],
      ] as never)
      // 2e appel : DELETE du code (usage unique)
      .mockResolvedValueOnce([{}, []] as never)
      // 3e appel : findById de l'utilisateur
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            name: 'Jean Google',
            email: 'jean@gmail.com',
            avatar: null,
            phone: null,
          },
        ],
        [],
      ] as never);

    const response = await request(app)
      .post('/api/auth/google/exchange')
      .send({ code: 'code-valide' });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
    expect(response.body.user).toEqual({
      id: 7,
      name: 'Jean Google',
      email: 'jean@gmail.com',
      avatar: null,
      phone: null,
    });

    // Le token est un vrai JWT (non mocké) : on vérifie son contenu décodé
    // plutôt qu'une valeur figée, ce qui évite toute dépendance fragile à
    // l'ordre des mocks.
    const decoded = jwt.decode(response.body.token) as {
      id: number; email: string; name: string;
    };
    expect(decoded.id).toBe(7);
    expect(decoded.email).toBe('jean@gmail.com');
    expect(decoded.name).toBe('Jean Google');

    // Le code doit être supprimé (usage unique)
    expect(mockedPool.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM google_auth_codes WHERE code = ?',
      ['code-valide'],
    );
  });

  it('doit refuser si l\'utilisateur associé au code n\'existe plus', async () => {
    const validExpiry = new Date(Date.now() + 30_000);

    mockedPool.query
      .mockResolvedValueOnce([
        [{ user_id: 99, expires_at: validExpiry }],
        [],
      ] as never)
      .mockResolvedValueOnce([{}, []] as never) // DELETE
      .mockResolvedValueOnce([[], []] as never); // findById → rien trouvé

    const response = await request(app)
      .post('/api/auth/google/exchange')
      .send({ code: 'code-orphelin' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Code invalide ou expiré');
  });
});
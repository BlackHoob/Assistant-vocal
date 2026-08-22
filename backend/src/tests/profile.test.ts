import express from 'express';
import request from 'supertest';

import { profileRouter } from '../routes/profile';
import { pool } from '../config/db';
import { deleteUploadedFile } from '../utils/fileUpload';

/* -------------------------------------------------------------------------- */
/*                                   MOCKS                                    */
/* -------------------------------------------------------------------------- */

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../middleware/authGuard', () => ({
  authGuard: (
    req: any,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    const id = Number(req.headers['x-test-user-id'] || 1);

    req.user = {
      id,
      name: 'Jean Test',
      email: 'jean@example.com',
    };

    next();
  },
}));

jest.mock('../utils/fileUpload', () => ({
  createUploadMiddleware: jest.fn(() => ({
    single: jest.fn(() => {
      return (
        req: any,
        _res: express.Response,
        next: express.NextFunction,
      ) => {
        if (req.headers['x-test-file'] === 'true') {
          req.file = {
            filename: 'test-avatar.png',
            size: 1234,
            mimetype: 'image/png',
          };
        }
        next();
      };
    }),
  })),
  deleteUploadedFile: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/*                                   MOCKED                                   */
/* -------------------------------------------------------------------------- */

const mockedPool = pool as jest.Mocked<typeof pool>;

const mockedDeleteUploadedFile =
  deleteUploadedFile as jest.MockedFunction<typeof deleteUploadedFile>;

/* -------------------------------------------------------------------------- */
/*                                    APP                                     */
/* -------------------------------------------------------------------------- */

const app = express();

app.use(express.json());

app.use('/api/profile', profileRouter);

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

describe('Profile routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  /* ======================================================================== */
  /*                                GET /                                     */
  /* ======================================================================== */

  describe('GET /api/profile', () => {
    it('doit retourner le profil de l\'utilisateur connecté', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            name: 'Jean',
            email: 'jean@example.com',
            avatar: null,
            phone: null,
          },
        ],
        [],
      ] as never);

      const response = await request(app).get('/api/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        avatar: null,
        phone: null,
      });
    });
  });

  /* ======================================================================== */
  /*                                PUT /                                     */
  /* ======================================================================== */

  describe('PUT /api/profile', () => {
    it('doit modifier le nom et le téléphone', async () => {
      mockedPool.query
        .mockResolvedValueOnce([{}, []] as never) // UPDATE
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'Nouveau nom',
              email: 'jean@example.com',
              avatar: null,
              phone: '0600000000',
            },
          ],
          [],
        ] as never); // SELECT après update

      const response = await request(app)
        .put('/api/profile')
        .send({ name: 'Nouveau nom', phone: '0600000000' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Nouveau nom');
    });
  });

  /* ======================================================================== */
  /*                            POST /avatar                                  */
  /* ======================================================================== */

  describe('POST /api/profile/avatar', () => {
    it('doit refuser sans fichier', async () => {
      const response = await request(app).post('/api/profile/avatar');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Fichier requis');
    });

    it('doit remplacer un avatar existant (ancien fichier supprimé)', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [{ id: 1, avatar: 'old-avatar.png' }],
          [],
        ] as never) // findById (avatar courant)
        .mockResolvedValueOnce([{}, []] as never); // UPDATE

      const response = await request(app)
        .post('/api/profile/avatar')
        .set('x-test-file', 'true');

      expect(response.status).toBe(200);
      expect(response.body.avatar).toBe('test-avatar.png');
      expect(mockedDeleteUploadedFile).toHaveBeenCalledWith(
        'avatars',
        'old-avatar.png',
      );
    });
  });

  /* ======================================================================== */
  /*                           DELETE /avatar                                 */
  /* ======================================================================== */

  describe('DELETE /api/profile/avatar', () => {
    it('doit supprimer l\'avatar courant', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [{ id: 1, avatar: 'old-avatar.png' }],
          [],
        ] as never)
        .mockResolvedValueOnce([{}, []] as never);

      const response = await request(app).delete('/api/profile/avatar');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Avatar supprimé' });
      expect(mockedDeleteUploadedFile).toHaveBeenCalledWith(
        'avatars',
        'old-avatar.png',
      );
    });
  });

  /* ======================================================================== */
  /*                    DELETE / — droit à l'effacement                       */
  /* ======================================================================== */

  describe('DELETE /api/profile — droit à l\'effacement', () => {
    it('doit supprimer l\'avatar, les documents et le compte', async () => {
      // 1er + 2e appels (Promise.all) : findById (user) et findByUser (documents)
      mockedPool.query
        .mockResolvedValueOnce([
          [{ id: 1, avatar: 'my-avatar.png' }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            { id: 10, userId: 1, file_path: '/uploads/documents/passport.pdf' },
            { id: 11, userId: 1, file_path: '/uploads/documents/ticket.pdf' },
          ],
          [],
        ] as never)
        // 3e appel : DELETE FROM users
        .mockResolvedValueOnce([{}, []] as never);

      const response = await request(app).delete('/api/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      expect(mockedDeleteUploadedFile).toHaveBeenCalledTimes(3);
      expect(mockedDeleteUploadedFile).toHaveBeenCalledWith(
        'avatars',
        'my-avatar.png',
      );
      expect(mockedDeleteUploadedFile).toHaveBeenCalledWith(
        'documents',
        'passport.pdf',
      );
      expect(mockedDeleteUploadedFile).toHaveBeenCalledWith(
        'documents',
        'ticket.pdf',
      );

      expect(mockedPool.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['1'],
      );
    });

    it('doit supprimer le compte même sans avatar ni document', async () => {
      mockedPool.query
        .mockResolvedValueOnce([[{ id: 1, avatar: null }], []] as never)
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([{}, []] as never);

      const response = await request(app).delete('/api/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockedDeleteUploadedFile).not.toHaveBeenCalled();
    });

    it('doit supprimer le compte même si un fichier est déjà absent du disque', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [{ id: 1, avatar: 'avatar.png' }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ id: 10, userId: 1, file_path: '/uploads/documents/manquant.pdf' }],
          [],
        ] as never)
        .mockResolvedValueOnce([{}, []] as never);

      mockedDeleteUploadedFile
        .mockImplementationOnce(() => {
          throw new Error('avatar introuvable');
        })
        .mockImplementationOnce(() => {
          throw new Error('document introuvable');
        });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const response = await request(app).delete('/api/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      consoleErrorSpy.mockRestore();
    });

    it('doit isoler la suppression à l\'utilisateur connecté (pas de suppression croisée)', async () => {
      mockedPool.query
        .mockResolvedValueOnce([[{ id: 42, avatar: null }], []] as never)
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([{}, []] as never);

      const response = await request(app)
        .delete('/api/profile')
        .set('x-test-user-id', '42');

      expect(response.status).toBe(200);
      expect(mockedPool.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['42'],
      );
    });
  });
});

import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  adminAuthRouter,
  ADMIN_JWT_SECRET,
} from '../routes/adminAuth';

import { pool } from '../config/db';

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedPool = pool as jest.Mocked<typeof pool>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const app = express();

app.use(express.json());
app.use('/api/admin/auth', adminAuthRouter);

// Middleware de gestion des erreurs utilisé uniquement pour les tests.
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

describe('Admin authentication routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // LOGIN
  // ============================================================

  describe('POST /api/admin/auth/login', () => {
    it('doit refuser une connexion si les identifiants sont manquants', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Identifiants requis');

      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it('doit refuser une connexion si le username est manquant', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Identifiants requis');

      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it('doit refuser un administrateur inexistant', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'unknown',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Identifiants invalides');

      expect(mockedPool.query).toHaveBeenCalledWith(
        'SELECT * FROM admins WHERE username = ? OR email = ?',
        ['unknown', 'unknown'],
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('doit refuser un mauvais mot de passe', async () => {
      const admin = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
        created_at: '2026-08-10',
      };

      mockedPool.query.mockResolvedValueOnce([
        [admin],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Identifiants invalides');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'wrong-password',
        'hashed-password',
      );
    });

    it('doit connecter un administrateur avec des identifiants valides', async () => {
      const admin = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
        created_at: '2026-08-10',
      };

      mockedPool.query
        .mockResolvedValueOnce([
          [admin],
          [],
        ] as never)
        .mockResolvedValueOnce([
          {},
          [],
        ] as never);

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'password123',
        });

      expect(response.status).toBe(200);

      expect(response.body.admin).toEqual({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      });

      expect(response.body.token).toEqual(
        expect.any(String),
      );

      const decoded = jwt.verify(
        response.body.token,
        ADMIN_JWT_SECRET,
      ) as {
        id: number;
        username: string;
        email: string;
        role: string;
      };

      expect(decoded.id).toBe(1);
      expect(decoded.username).toBe('admin');
      expect(decoded.email).toBe('admin@example.com');
      expect(decoded.role).toBe('admin');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );

      expect(response.body.admin.password_hash).toBeUndefined();

      expect(mockedPool.query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM admins WHERE username = ? OR email = ?',
        ['admin', 'admin'],
      );

      expect(mockedPool.query).toHaveBeenNthCalledWith(
        2,
        'UPDATE admins SET last_login = NOW() WHERE id = ?',
        [1],
      );
    });

    it('doit accepter une connexion avec une adresse email', async () => {
      const admin = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
        created_at: '2026-08-10',
      };

      mockedPool.query
        .mockResolvedValueOnce([
          [admin],
          [],
        ] as never)
        .mockResolvedValueOnce([
          {},
          [],
        ] as never);

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);

      expect(response.body.admin).toEqual({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      });

      expect(mockedPool.query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM admins WHERE username = ? OR email = ?',
        ['admin@example.com', 'admin@example.com'],
      );
    });

    it('doit continuer à connecter même si la mise à jour de last_login échoue', async () => {
      const admin = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
        created_at: '2026-08-10',
      };

      mockedPool.query
        .mockResolvedValueOnce([
          [admin],
          [],
        ] as never)
        .mockRejectedValueOnce(
          new Error('Erreur last_login'),
        );

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'admin',
          password: 'password123',
        });

      expect(response.status).toBe(200);

      expect(response.body.admin).toEqual({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      });

      expect(response.body.token).toEqual(
        expect.any(String),
      );
    });
  });

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  describe('POST /api/admin/auth/change-password', () => {
    const admin = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      password_hash: 'old-hashed-password',
      role: 'admin',
      created_at: '2026-08-10',
    };

    const createToken = () =>
      jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
        ADMIN_JWT_SECRET,
      );

    it('doit refuser la requête si le token est absent', async () => {
      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(401);

      // adminAuth.ts utilise UnauthorizedError() sans message.
      expect(response.body.error).toBe('Non autorisé');

      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it('doit refuser un token administrateur invalide', async () => {
      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          'Bearer token-invalide',
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      /*
       * adminAuth.ts ne possède actuellement aucun try/catch
       * autour de jwt.verify().
       *
       * Donc l'erreur JsonWebTokenError remonte jusqu'au
       * middleware d'erreur et produit 500.
       */
      expect(response.status).toBe(500);
    });

    it('doit refuser un nouveau mot de passe manquant', async () => {
      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'oldPassword123',
        });

      /*
       * Dans adminAuth.ts :
       *
       * if (!newPassword || newPassword.length < 8)
       *
       * les deux cas utilisent le même message.
       */
      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Mot de passe min. 8 caractères',
      );

      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it('doit refuser un nouveau mot de passe trop court', async () => {
      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: '1234567',
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Mot de passe min. 8 caractères',
      );

      expect(mockedPool.query).not.toHaveBeenCalled();
    });

    it('doit refuser un ancien mot de passe manquant', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [admin],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          newPassword: 'newPassword123',
        });

      /*
       * La route ne vérifie pas explicitement
       * currentPassword avant bcrypt.compare().
       *
       * undefined est donc transmis à bcrypt.compare().
       */
      expect(response.status).toBe(401);

      expect(response.body.error).toBe(
        'Mot de passe actuel incorrect',
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        undefined,
        'old-hashed-password',
      );
    });

    it('doit refuser un administrateur inexistant', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(401);

      /*
       * UnauthorizedError() est utilisé sans message
       * dans adminAuth.ts.
       */
      expect(response.body.error).toBe('Non autorisé');

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('doit refuser un ancien mot de passe incorrect', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [admin],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(401);

      expect(response.body.error).toBe(
        'Mot de passe actuel incorrect',
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'wrongPassword',
        'old-hashed-password',
      );

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('doit modifier le mot de passe avec succès', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [admin],
          [],
        ] as never)
        .mockResolvedValueOnce([
          {},
          [],
        ] as never);

      mockedBcrypt.compare.mockResolvedValue(true as never);

      mockedBcrypt.hash.mockResolvedValue(
        'new-hashed-password' as never,
      );

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'oldPassword123',
        'old-hashed-password',
      );

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        'newPassword123',
        12,
      );

      expect(mockedPool.query).toHaveBeenLastCalledWith(
        'UPDATE admins SET password_hash = ? WHERE id = ?',
        ['new-hashed-password', 1],
      );
    });

    it('doit refuser un token expiré', async () => {
      const expiredToken = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
        ADMIN_JWT_SECRET,
        {
          expiresIn: -1,
        },
      );

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${expiredToken}`,
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      /*
       * Comme pour un token invalide :
       * jwt.verify() lève directement une exception.
       * adminAuth.ts ne l'intercepte pas.
       */
      expect(response.status).toBe(500);
    });

    it('doit accepter un token avec un préfixe Bearer', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [admin],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(true as never);

      mockedBcrypt.hash.mockResolvedValue(
        'new-hashed-password' as never,
      );

      const response = await request(app)
        .post('/api/admin/auth/change-password')
        .set(
          'Authorization',
          `Bearer ${createToken()}`,
        )
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});




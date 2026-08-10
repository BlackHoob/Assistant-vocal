import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { authRouter, JWT_SECRET } from '../routes/auth';
import { pool } from '../config/db';
import { sendPasswordResetEmail } from '../routes/mailer';

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../routes/mailer', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const mockedPool = pool.query as jest.MockedFunction<typeof pool.query>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSendPasswordResetEmail =
  sendPasswordResetEmail as jest.MockedFunction<
    typeof sendPasswordResetEmail
  >;

const app = express();

app.use(express.json());
app.use('/api/auth', authRouter);

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

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('doit refuser une inscription si des champs sont manquants', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jean',
          email: 'jean@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tous les champs sont requis');

      expect(mockedPool).not.toHaveBeenCalled();
    });

    it('doit refuser un mot de passe trop court', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jean',
          email: 'jean@example.com',
          password: '1234567',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Mot de passe min. 8 caractères',
      );

      expect(mockedPool).not.toHaveBeenCalled();
    });

    it('doit refuser un email déjà utilisé', async () => {
      mockedPool.mockResolvedValueOnce([
        [
          {
            id: 1,
            name: 'Jean',
            email: 'jean@example.com',
            phone: null,
            avatar: null,
            password_hash: 'hash',
            blocked: false,
            notifyEmail: true,
            notifyPush: true,
            reset_token: null,
            reset_token_expires: null,
            created_at: '2026-08-10',
          },
        ],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jean',
          email: 'jean@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe(
        'Cet email est déjà utilisé',
      );
    });

    it('doit créer un utilisateur avec des données valides', async () => {
      const createdUser = {
        id: 10,
        name: 'Jean',
        email: 'jean@example.com',
        phone: null,
        avatar: null,
        password_hash: 'hashed-password',
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([{ insertId: 10 }, []] as never)
        .mockResolvedValueOnce([[createdUser], []] as never);

      mockedBcrypt.hash.mockResolvedValue(
        'hashed-password' as never,
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jean',
          email: 'jean@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);

      expect(response.body.user).toEqual({
        id: 10,
        name: 'Jean',
        email: 'jean@example.com',
        avatar: null,
        phone: null,
      });

      expect(response.body.token).toEqual(expect.any(String));

      const decoded = jwt.verify(
        response.body.token,
        JWT_SECRET,
      ) as {
        id: number;
        email: string;
        name: string;
      };

      expect(decoded.id).toBe(10);
      expect(decoded.email).toBe('jean@example.com');
      expect(decoded.name).toBe('Jean');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        'password123',
        12,
      );
    });
  });

  describe('POST /api/auth/login', () => {
    it('doit refuser une connexion si les champs sont manquants', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jean@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Email et mot de passe requis',
      );
    });

    it('doit refuser un utilisateur inexistant', async () => {
      mockedPool.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        'Identifiants invalides',
      );
    });

    it('doit refuser un compte sans password_hash', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: null,
        avatar: null,
        password_hash: null,
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jean@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        'Ce compte utilise une autre méthode de connexion',
      );
    });

    it('doit refuser un compte bloqué', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: null,
        avatar: null,
        password_hash: 'hashed-password',
        blocked: true,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jean@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Ce compte a été bloqué par l'agence",
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('doit refuser un mauvais mot de passe', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: null,
        avatar: null,
        password_hash: 'hashed-password',
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jean@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        'Identifiants invalides',
      );
    });

    it('doit connecter un utilisateur avec des identifiants valides', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: '0600000000',
        avatar: null,
        password_hash: 'hashed-password',
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jean@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);

      expect(response.body.user).toEqual({
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: '0600000000',
        avatar: null,
      });

      expect(response.body.token).toEqual(expect.any(String));

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );

      expect(response.body.user.password_hash).toBeUndefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('doit refuser la requête si le token est absent', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token manquant');
    });

    it('doit refuser la requête si le token est invalide', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-invalide');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token invalide');
    });

    it('doit retourner une erreur si l’utilisateur n’existe plus', async () => {
      const token = jwt.sign(
        {
          id: 999,
          email: 'unknown@example.com',
          name: 'Unknown',
        },
        JWT_SECRET,
      );

      mockedPool.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(
        'Utilisateur introuvable',
      );
    });

    it('doit retourner les informations sécurisées de l’utilisateur', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: '0600000000',
        avatar: null,
        password_hash: 'secret-hash',
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        JWT_SECRET,
      );

      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: '0600000000',
        avatar: null,
      });

      expect(response.body.password_hash).toBeUndefined();
      expect(response.body.reset_token).toBeUndefined();
    });
  });

  describe('PUT /api/auth/change-password', () => {
    const user = {
      id: 1,
      name: 'Jean',
      email: 'jean@example.com',
      phone: '0600000000',
      avatar: null,
      password_hash: 'old-hashed-password',
      blocked: false,
      notifyEmail: true,
      notifyPush: true,
      reset_token: null,
      reset_token_expires: null,
      created_at: '2026-08-10',
    };

    const createToken = () =>
      jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        JWT_SECRET,
      );

    it('doit refuser un nouveau mot de passe trop court', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
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
        'Nouveau mot de passe min. 8 caractères',
      );
    });

    it('doit refuser un ancien mot de passe incorrect', async () => {
      mockedPool.mockResolvedValueOnce([
        [user],
        [],
      ] as never);

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .put('/api/auth/change-password')
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

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('doit modifier le mot de passe avec succès', async () => {
      mockedPool
        .mockResolvedValueOnce([
          [user],
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
        .put('/api/auth/change-password')
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

      expect(mockedPool).toHaveBeenLastCalledWith(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        ['new-hashed-password', 1],
      );
    });
  });
    describe('POST /api/auth/forgot-password', () => {
    it('doit refuser la requête si l’email est absent', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email requis');

      expect(mockedPool).not.toHaveBeenCalled();
    });

    it('doit retourner un succès même si l’utilisateur n’existe pas', async () => {
      mockedPool.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'unknown@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
      });

      expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('doit générer un token et envoyer un email si l’utilisateur existe', async () => {
      const user = {
        id: 1,
        name: 'Jean',
        email: 'jean@example.com',
        phone: '0600000000',
        avatar: null,
        password_hash: 'hashed-password',
        blocked: false,
        notifyEmail: true,
        notifyPush: true,
        reset_token: null,
        reset_token_expires: null,
        created_at: '2026-08-10',
      };

      mockedPool
        .mockResolvedValueOnce([
          [user],
          [],
        ] as never)
        .mockResolvedValueOnce([
          {},
          [],
        ] as never);

      mockedSendPasswordResetEmail.mockResolvedValue(
        undefined as never,
      );

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'jean@example.com',
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(mockedPool).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        expect.arrayContaining([
          expect.any(String),
          expect.any(Date),
          1,
        ]),
      );

      expect(mockedSendPasswordResetEmail).toHaveBeenCalledWith(
        'jean@example.com',
        expect.stringMatching(
          /\/reset-password\?token=.+/,
        ),
      );
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('doit refuser la requête si le token ou le mot de passe est absent', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'reset-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Token et mot de passe requis',
      );

      expect(mockedPool).not.toHaveBeenCalled();
    });

    it('doit refuser un nouveau mot de passe trop court', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'reset-token',
          password: '1234567',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Minimum 8 caractères',
      );

      expect(mockedPool).not.toHaveBeenCalled();
    });

    it('doit refuser un token invalide ou expiré', async () => {
      mockedPool.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Lien invalide ou expiré',
      );

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('doit réinitialiser le mot de passe avec un token valide', async () => {
      mockedPool
        .mockResolvedValueOnce([
          [{ id: 1 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          {},
          [],
        ] as never);

      mockedBcrypt.hash.mockResolvedValue(
        'new-hashed-password' as never,
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: 'newPassword123',
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        'newPassword123',
        12,
      );

      expect(mockedPool).toHaveBeenLastCalledWith(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        ['new-hashed-password', 1],
      );
    });
  });
});
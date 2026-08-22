import express from 'express';
import request from 'supertest';

import { createAuthLimiter } from '../middleware/rateLimiter';

describe('createAuthLimiter', () => {
  it('bloque après le nombre maximal de requêtes autorisées', async () => {
    const app = express();
    app.use(createAuthLimiter({ windowMs: 60_000, max: 3, skip: () => false }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe('Trop de tentatives, réessayez plus tard.');
  });

  it('laisse passer les requêtes tant que la limite n\'est pas atteinte', async () => {
    const app = express();
    app.use(createAuthLimiter({ windowMs: 60_000, max: 5, skip: () => false }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
  });

  it('est désactivé automatiquement quand NODE_ENV vaut test (comportement par défaut)', async () => {
    const app = express();
    // Pas de skip forcé ici : on vérifie le comportement par défaut, qui
    // désactive le limiteur pendant les tests (process.env.NODE_ENV
    // vaut déjà 'test' sous Jest).
    app.use(createAuthLimiter({ windowMs: 60_000, max: 1 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    }
  });
});
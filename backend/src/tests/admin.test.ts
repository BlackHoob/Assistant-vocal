
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

import {
  adminRouter,
  mergeMonthlySeries,
} from '../routes/admin';

import { pool } from '../config/db';
import { createNotification } from '../routes/notifications';

/* -------------------------------------------------------------------------- */
/*                                   MOCKS                                    */
/* -------------------------------------------------------------------------- */

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../routes/notifications', () => ({
  createNotification: jest.fn(),
}));

jest.mock('../middleware/adminGuard', () => ({
  adminGuard: (
    req: any,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    const role = req.headers['x-test-admin-role'] || 'admin';

    req.admin = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role,
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
            filename: 'test-document.pdf',
            size: 12345,
            mimetype: 'application/pdf',
          };
        }

        next();
      };
    }),
  })),
}));

/* -------------------------------------------------------------------------- */
/*                                   MOCKED                                   */
/* -------------------------------------------------------------------------- */

const mockedPool = pool as jest.Mocked<typeof pool>;

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockedCreateNotification =
  createNotification as jest.MockedFunction<
    typeof createNotification
  >;

/* -------------------------------------------------------------------------- */
/*                                    APP                                     */
/* -------------------------------------------------------------------------- */

const app = express();

app.use(express.json());

app.use('/api/admin', adminRouter);

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

describe('Admin routes', () => {
  beforeEach(() => {
    /*
     * resetAllMocks() est important ici.
     *
     * clearAllMocks() efface uniquement les appels.
     * resetAllMocks() efface également les valeurs des mocks,
     * ce qui évite qu'un mockResolvedValueOnce() d'un test
     * soit récupéré par le test suivant.
     */
    jest.resetAllMocks();
  });

  /* ======================================================================== */
  /*                         mergeMonthlySeries                              */
  /* ======================================================================== */

  describe('mergeMonthlySeries', () => {
    it('doit fusionner deux séries mensuelles', () => {
      const appointments = [
        {
          month: '2026-01',
          count: 10,
        },
        {
          month: '2026-03',
          count: 30,
        },
      ];

      const tickets = [
        {
          month: '2026-01',
          count: 5,
        },
        {
          month: '2026-02',
          count: 20,
        },
      ];

      const result = mergeMonthlySeries(
        appointments,
        tickets,
        'appointments',
        'tickets',
      );

      expect(result).toEqual([
        {
          month: '2026-01',
          appointments: 10,
          tickets: 5,
        },
        {
          month: '2026-02',
          appointments: 0,
          tickets: 20,
        },
        {
          month: '2026-03',
          appointments: 30,
          tickets: 0,
        },
      ]);
    });

    it('doit gérer deux séries vides', () => {
      expect(
        mergeMonthlySeries(
          [],
          [],
          'appointments',
          'tickets',
        ),
      ).toEqual([]);
    });
  });

  /* ======================================================================== */
  /*                               DASHBOARD                                  */
  /* ======================================================================== */

  describe('GET /api/admin/stats', () => {
    it('doit retourner les statistiques du dashboard', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [{ totalUsers: 100 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalAppointments: 20 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalTickets: 30 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalDocuments: 40 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ upcomingAppointments: 5 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ upcomingTickets: 8 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              date: '2026-08-10',
              count: 4,
              type: 'appointment',
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              month: '2026-07',
              count: 10,
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              month: '2026-07',
              count: 5,
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              month: '2026-07',
              count: 3,
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              destination: 'Paris',
              count: 15,
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalIAMessages: 100 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalIAUsers: 20 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ iaConversationsToday: 5 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ usersWithTicket: 10 }],
          [],
        ] as never);

      const response = await request(app).get(
        '/api/admin/stats',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        totalUsers: 100,
        totalAppointments: 20,
        totalTickets: 30,
        totalDocuments: 40,
        upcomingAppointments: 5,
        upcomingTickets: 8,
        recentActivity: [
          {
            date: '2026-08-10',
            count: 4,
            type: 'appointment',
          },
        ],
        bookingsByMonth: [
          {
            month: '2026-07',
            appointments: 10,
            tickets: 5,
          },
        ],
        newUsersByMonth: [
          {
            month: '2026-07',
            count: 3,
          },
        ],
        topDestinations: [
          {
            destination: 'Paris',
            count: 15,
          },
        ],
        ia: {
          totalMessages: 100,
          totalUsers: 20,
          conversationsToday: 5,
          conversionRate: 50,
        },
      });
    });

    it('doit retourner un taux de conversion de 0 sans utilisateur IA', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [{ totalUsers: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalAppointments: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalTickets: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalDocuments: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ upcomingAppointments: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ upcomingTickets: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalIAMessages: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ totalIAUsers: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ iaConversationsToday: 0 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ usersWithTicket: 0 }],
          [],
        ] as never);

      const response = await request(app).get(
        '/api/admin/stats',
      );

      expect(response.status).toBe(200);
      expect(response.body.ia.conversionRate).toBe(0);
    });
  });

  /* ======================================================================== */
  /*                                  USERS                                   */
  /* ======================================================================== */

  describe('Users', () => {
    it('doit retourner la liste des utilisateurs', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'Jean',
              email: 'jean@example.com',
              appointmentCount: 2,
              ticketCount: 3,
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ total: 1 }],
          [],
        ] as never);

      const response = await request(app)
        .get('/api/admin/users')
        .query({
          search: 'Jean',
          page: '1',
          limit: '20',
        });

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.pages).toBe(1);
    });

    it('doit retourner un utilisateur avec ses données associées', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'Jean',
              email: 'jean@example.com',
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ id: 10, userId: 1 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ id: 20, userId: 1 }],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ id: 30, userId: 1 }],
          [],
        ] as never);

      const response = await request(app).get(
        '/api/admin/users/1',
      );

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(1);
      expect(response.body.appointments).toHaveLength(1);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.documents).toHaveLength(1);
    });

    it('doit supprimer un utilisateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).delete(
        '/api/admin/users/1',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });

      expect(mockedPool.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['1'],
      );
    });

    it('doit modifier un utilisateur', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          {},
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'Nouveau nom',
              email: 'new@example.com',
              phone: '0600000000',
              avatar: null,
              blocked: 0,
            },
          ],
          [],
        ] as never);

      const response = await request(app)
        .put('/api/admin/users/1')
        .send({
          name: 'Nouveau nom',
          email: 'new@example.com',
          phone: '0600000000',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(
        'Nouveau nom',
      );
    });

    it('doit refuser la modification sans champ', async () => {
      const response = await request(app)
        .put('/api/admin/users/1')
        .send({});

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Aucun champ à modifier',
      );
    });

    it('doit refuser un email déjà utilisé', async () => {
      mockedPool.query.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
      });

      const response = await request(app)
        .put('/api/admin/users/1')
        .send({
          email: 'existing@example.com',
        });

      expect(response.status).toBe(409);

      expect(response.body.error).toBe(
        'Email déjà utilisé',
      );
    });

    it('doit bloquer un utilisateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app)
        .put('/api/admin/users/1/block')
        .send({
          blocked: true,
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        blocked: true,
      });
    });

    it('doit débloquer un utilisateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app)
        .put('/api/admin/users/1/block')
        .send({
          blocked: false,
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        blocked: false,
      });
    });
  });

  /* ======================================================================== */
  /*                              APPOINTMENTS                                */
  /* ======================================================================== */

  describe('Appointments', () => {
    it('doit retourner les rendez-vous sans filtre', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              title: 'Rendez-vous',
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ total: 1 }],
          [],
        ] as never);

      const response = await request(app).get(
        '/api/admin/appointments',
      );

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.appointments).toHaveLength(1);
    });

    it('doit filtrer les rendez-vous', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ total: 0 }],
          [],
        ] as never);

      const response = await request(app)
        .get('/api/admin/appointments')
        .query({
          status: 'upcoming',
          from: '2026-08-01',
          to: '2026-08-31',
          limit: '10',
        });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('doit supprimer un rendez-vous', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).delete(
        '/api/admin/appointments/1',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });

    it('doit modifier un rendez-vous', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          {},
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              title: 'Nouveau titre',
              status: 'confirmed',
            },
          ],
          [],
        ] as never);

      const response = await request(app)
        .put('/api/admin/appointments/1')
        .send({
          title: 'Nouveau titre',
          description: null,
          dateTime: '2026-08-20 14:00:00',
          location: null,
          status: 'confirmed',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(
        'Nouveau titre',
      );
    });

    it('doit refuser une modification sans champ', async () => {
      const response = await request(app)
        .put('/api/admin/appointments/1')
        .send({});

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Aucun champ à modifier',
      );
    });

    it('doit bloquer un rendez-vous', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).put(
        '/api/admin/appointments/1/block',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });
  });

  /* ======================================================================== */
  /*                                WAITLIST                                  */
  /* ======================================================================== */

  describe('Waitlist', () => {
    it('doit retourner la liste d’attente', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 10,
            name: 'Jean',
            date: '2026-08-20',
            quantity: 2,
            created_at: '2026-08-10 10:00:00',
          },
          {
            id: 2,
            userId: 11,
            name: 'Marie',
            date: '2026-08-20',
            quantity: 1,
            created_at: '2026-08-10 11:00:00',
          },
        ],
        [],
      ] as never);

      const response = await request(app).get(
        '/api/admin/waitlist',
      );

      expect(response.status).toBe(200);

      expect(response.body[0].rank).toBe(1);
      expect(response.body[1].rank).toBe(2);

      expect(response.body[0].total).toBe(2);
      expect(response.body[1].total).toBe(2);
    });

    it('doit filtrer la liste d’attente par date', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/admin/waitlist')
        .query({
          date: '2026-08-20',
        });

      expect(response.status).toBe(200);
    });

    it('doit filtrer la liste d’attente par période', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/admin/waitlist')
        .query({
          from: '2026-08-01',
          to: '2026-08-31',
        });

      expect(response.status).toBe(200);
    });

    it('doit supprimer une entrée de liste d’attente', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).delete(
        '/api/admin/waitlist/1',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });
  });

  /* ======================================================================== */
  /*                                 TICKETS                                  */
  /* ======================================================================== */

  describe('Tickets', () => {
    it('doit retourner les billets', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              userId: 1,
              destination: 'Paris',
            },
          ],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ total: 1 }],
          [],
        ] as never);

      const response = await request(app).get(
        '/api/admin/tickets',
      );

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.tickets).toHaveLength(1);
    });

    it('doit filtrer les billets par statut', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          [],
          [],
        ] as never)
        .mockResolvedValueOnce([
          [{ total: 0 }],
          [],
        ] as never);

      const response = await request(app)
        .get('/api/admin/tickets')
        .query({
          status: 'confirmed',
          limit: '10',
        });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('doit supprimer un billet', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).delete(
        '/api/admin/tickets/1',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });
  });

  /* ======================================================================== */
  /*                             CONVERSATIONS IA                             */
  /* ======================================================================== */

  describe('Conversations IA', () => {
    it('doit retourner toutes les conversations', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 10,
            role: 'user',
            content: 'Bonjour',
          },
        ],
        [],
      ] as never);

      const response = await request(app).get(
        '/api/admin/conversations',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('doit filtrer les conversations par utilisateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 10,
          },
        ],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/admin/conversations')
        .query({
          userId: '10',
          limit: '20',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  /* ======================================================================== */
  /*                              NOTIFICATIONS                               */
  /* ======================================================================== */

  describe('Notifications', () => {
    it('doit refuser une notification sans message', async () => {
      const response = await request(app)
        .post('/api/admin/notifications/send')
        .send({
          target: 'user',
          userId: 1,
          message: '   ',
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Message requis',
      );
    });

    it('doit refuser un envoi ciblé sans userId', async () => {
      const response = await request(app)
        .post('/api/admin/notifications/send')
        .send({
          target: 'user',
          message: 'Bonjour',
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'userId requis pour un envoi ciblé',
      );
    });

    it('doit envoyer une notification à un utilisateur', async () => {
      mockedCreateNotification.mockResolvedValueOnce(
        undefined as never,
      );

      const response = await request(app)
        .post('/api/admin/notifications/send')
        .send({
          target: 'user',
          userId: 10,
          type: 'info',
          category: 'system',
          message: 'Bonjour',
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        sent: 1,
      });

      expect(
        mockedCreateNotification,
      ).toHaveBeenCalledWith(
        10,
        'info',
        'system',
        'Bonjour',
      );
    });

    it('doit envoyer une notification à tous les utilisateurs', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ],
        [],
      ] as never);

      mockedCreateNotification.mockResolvedValue(
        undefined as never,
      );

      const response = await request(app)
        .post('/api/admin/notifications/send')
        .send({
          target: 'all',
          message: 'Maintenance prévue',
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        sent: 3,
      });

      expect(
        mockedCreateNotification,
      ).toHaveBeenCalledTimes(3);
    });

    it('doit retourner les notifications', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 10,
            message: 'Bonjour',
          },
        ],
        [],
      ] as never);

      const response = await request(app).get(
        '/api/admin/notifications',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  /* ======================================================================== */
  /*                                 DOCUMENTS                                */
  /* ======================================================================== */

  describe('Documents', () => {
    it('doit refuser un document sans userId', async () => {
      const response = await request(app)
        .post('/api/admin/documents/send')
        .set('x-test-file', 'true')
        .send({
          type: 'passport',
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'userId requis',
      );
    });

    it('doit refuser un document sans fichier', async () => {
      const response = await request(app)
        .post('/api/admin/documents/send')
        .send({
          userId: 10,
          type: 'passport',
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Fichier requis',
      );
    });

    it('doit envoyer un document à un utilisateur', async () => {
      mockedPool.query
        .mockResolvedValueOnce([
          {
            insertId: 100,
          },
          [],
        ] as never)
        .mockResolvedValueOnce([
          [
            {
              id: 100,
              userId: 10,
              name: 'passport',
              file_path:
                '/uploads/documents/test-document.pdf',
            },
          ],
          [],
        ] as never);

      mockedCreateNotification.mockResolvedValueOnce(
        undefined as never,
      );

      /*
       * Le faux middleware multer crée req.file lorsque
       * x-test-file=true.
       *
       * On utilise send() plutôt que field() car le mock
       * ne parse pas réellement multipart/form-data.
       */
      const response = await request(app)
        .post('/api/admin/documents/send')
        .set('x-test-file', 'true')
        .send({
          userId: 10,
          type: 'passport',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(100);

      expect(
        mockedCreateNotification,
      ).toHaveBeenCalled();
    });

    it('doit retourner les documents', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 10,
            name: 'passport',
          },
        ],
        [],
      ] as never);

      const response = await request(app).get(
        '/api/admin/documents',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(1);
    });

    it('doit filtrer les documents par utilisateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/admin/documents')
        .query({
          userId: '10',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('doit supprimer un document', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app).delete(
        '/api/admin/documents/1',
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });
  });

  /* ======================================================================== */
  /*                             ADMINISTRATEURS                              */
  /* ======================================================================== */

  describe('Administrateurs', () => {
    it('doit refuser un administrateur normal', async () => {
      const response = await request(app)
        .get('/api/admin/admins')
        .set('x-test-admin-role', 'admin');

      expect(response.status).toBe(403);
    });

    it('doit permettre à un superadmin de lister les administrateurs', async () => {
      mockedPool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin',
          },
        ],
        [],
      ] as never);

      const response = await request(app)
        .get('/api/admin/admins')
        .set(
          'x-test-admin-role',
          'superadmin',
        );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('doit permettre à un superadmin de créer un administrateur', async () => {
      mockedBcrypt.hash.mockResolvedValue(
        'hashed-password' as never,
      );

      mockedPool.query.mockResolvedValueOnce([
        {
          insertId: 2,
        },
        [],
      ] as never);

      const response = await request(app)
        .post('/api/admin/admins')
        .set(
          'x-test-admin-role',
          'superadmin',
        )
        .send({
          username: 'newadmin',
          email: 'newadmin@example.com',
          password: 'password123',
          role: 'admin',
        });

      expect(response.status).toBe(201);

      expect(response.body).toEqual({
        id: 2,
        username: 'newadmin',
        email: 'newadmin@example.com',
        role: 'admin',
      });

      expect(
        mockedBcrypt.hash,
      ).toHaveBeenCalledWith(
        'password123',
        12,
      );
    });

    it('doit utiliser admin comme rôle par défaut', async () => {
      mockedBcrypt.hash.mockResolvedValue(
        'hashed-password' as never,
      );

      mockedPool.query.mockResolvedValueOnce([
        {
          insertId: 3,
        },
        [],
      ] as never);

      const response = await request(app)
        .post('/api/admin/admins')
        .set(
          'x-test-admin-role',
          'superadmin',
        )
        .send({
          username: 'admin2',
          email: 'admin2@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe('admin');
    });

    it('doit gérer un doublon lors de la création', async () => {
      mockedBcrypt.hash.mockResolvedValue(
        'hashed-password' as never,
      );

      mockedPool.query.mockRejectedValueOnce({
        code: 'ER_DUP_ENTRY',
      });

      const response = await request(app)
        .post('/api/admin/admins')
        .set(
          'x-test-admin-role',
          'superadmin',
        )
        .send({
          username: 'admin',
          email: 'admin@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);

      expect(response.body.error).toBe(
        'Username ou email déjà utilisé',
      );
    });

    it('doit supprimer un autre administrateur', async () => {
      mockedPool.query.mockResolvedValueOnce([
        {},
        [],
      ] as never);

      const response = await request(app)
        .delete('/api/admin/admins/2')
        .set(
          'x-test-admin-role',
          'superadmin',
        );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
      });
    });

    it('doit empêcher un superadmin de supprimer son propre compte', async () => {
      const response = await request(app)
        .delete('/api/admin/admins/1')
        .set(
          'x-test-admin-role',
          'superadmin',
        );

      expect(response.status).toBe(400);

      expect(response.body.error).toBe(
        'Impossible de supprimer votre propre compte',
      );

      expect(
        mockedPool.query,
      ).not.toHaveBeenCalled();
    });

    it('doit refuser la suppression par un admin normal', async () => {
      const response = await request(app)
        .delete('/api/admin/admins/2')
        .set(
          'x-test-admin-role',
          'admin',
        );

      expect(response.status).toBe(403);
    });
  });
});


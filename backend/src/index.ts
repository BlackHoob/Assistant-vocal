import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import passport from 'passport';
import { authRouter } from './routes/auth';
import { authGoogleRouter } from './routes/authGoogle';
import { voiceRouter } from './routes/voice';
import { appointmentsRouter } from './routes/appointments';
import { documentsRouter } from './routes/documents';
import { ticketsRouter } from './routes/tickets';
import { profileRouter } from './routes/profile';
import { notificationsRouter } from './routes/notifications';
import { adminAuthRouter } from './routes/adminAuth';
import { adminRouter } from './routes/admin';
import './config/db';
import { errorHandler } from './middleware/errorHandler';
import { setupSwagger } from './swagger';

dotenv.config();

const app = express();

// ─── Helmet : en-têtes de sécurité HTTP ─────────────────────────────────
// La CSP par défaut de Helmet est désactivée : Swagger UI (actif
// uniquement hors production, voir plus bas) charge des scripts en ligne
// qu'une CSP stricte par défaut bloquerait. Les autres protections
// (X-Frame-Options, X-Content-Type-Options, HSTS, etc.) restent actives.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin'},
}));

// ─── Swagger : documentation d'API, jamais exposée en production ───────
// Publier le schéma de l'API en production faciliterait la cartographie
// des routes par un attaquant, sans bénéfice pour les utilisateurs finaux.
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

const PORT = process.env.PORT || 4000;

// ─── CORS : origines autorisées selon l'environnement ──────────────────
// En développement, seuls les ports locaux du frontend Vite sont acceptés.
// En production, la liste vient de la variable ALLOWED_ORIGINS (domaines
// réels du frontend déployé), pour ne jamais exposer l'API à un domaine
// non prévu. Aucune valeur codée en dur n'est partagée entre les deux
// environnements.
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = isProduction
  ? (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174'];

if (isProduction && allowedOrigins.length === 0) {
  // Échec explicite plutôt qu'un CORS silencieusement trop permissif ou
  // trop restrictif en production faute de configuration.
  console.error('ALLOWED_ORIGINS doit être défini en production (liste d\'origines séparées par des virgules).');
  process.exit(1);
}

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(passport.initialize());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/auth', authGoogleRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminRouter);
app.use(errorHandler)


app.get('/api/health', (_req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' }));
app.listen(PORT, () => console.log(`Nestor Vocal API http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`));
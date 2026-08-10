import express from 'express';
import cors from 'cors';
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
setupSwagger(app);
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Nestor Vocal API http://localhost:${PORT}`));
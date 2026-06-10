import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth';
import { voiceRouter } from './routes/voice';
import { appointmentsRouter } from './routes/appointments';
import { documentsRouter } from './routes/documents';
import { ticketsRouter } from './routes/tickets';
import { profileRouter } from './routes/profile';
import { adminAuthRouter } from './routes/adminAuth';
import { adminRouter } from './routes/admin';
import './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth utilisateurs (JWT + bcrypt maison)
app.use('/api/auth', authRouter);

// Routes protégées utilisateurs
app.use('/api/voice', voiceRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/profile', profileRouter);

// Admin
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`🚀 Nestor Vocal API — http://localhost:${PORT}`));
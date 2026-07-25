import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { JWT_SECRET } from './auth';
import { User } from '../types';
import dotenv from 'dotenv';
dotenv.config();

export const authGoogleRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';
const GOOGLE_TOKEN_EXPIRES = '7d';

// Cherche un utilisateur existant par google_id ou email, sinon le crée.
// Rattache le google_id à un compte email existant plutôt que d'en créer
// un doublon.
async function findOrCreateGoogleUser(profile: Profile): Promise<User> {
  const email = profile.emails?.[0]?.value || '';
  const name = profile.displayName || '';
  const googleId = profile.id;

  const [existing] = await pool.query(
    'SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]
  ) as [User[], unknown];

  if (existing[0]) {
    const user = existing[0];
    if (!(user as any).google_id) {
      await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
    }
    return user;
  }

  const [result] = await pool.query(
    'INSERT INTO users (name, email, google_id) VALUES (?, ?, ?)', [name, email, googleId]
  ) as [{ insertId: number }, unknown];
  const [created] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]) as [User[], unknown];
  return created[0];
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: `${BACKEND_URL}${GOOGLE_CALLBACK_PATH}`,
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const user = await findOrCreateGoogleUser(profile);
    done(null, user);
  } catch (err) {
    done(err as Error, undefined);
  }
}));

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]) as [User[], unknown];
  done(null, rows[0]);
});

// GET /api/auth/google — déclenche le OAuth Google
authGoogleRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /api/auth/google/callback — callback après auth Google
authGoogleRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
  (req: Request, res: Response) => {
    const user = req.user as User;
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: GOOGLE_TOKEN_EXPIRES }
    );
    const params = new URLSearchParams({ token, name: user.name, email: user.email, id: String(user.id) });
    res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  }
);

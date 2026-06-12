import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { JWT_SECRET } from './auth';
import dotenv from 'dotenv';
dotenv.config();

export const authGoogleRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID     || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL:  `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`,
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const email    = profile.emails?.[0]?.value || '';
    const name     = profile.displayName || '';
    const googleId = profile.id;

    // Chercher l'utilisateur existant
    const [rows]: any = await pool.query(
      'SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]
    );

    let user = rows[0];

    if (user) {
      // Mettre à jour le google_id si connexion par email existant
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
        user.google_id = googleId;
      }
    } else {
      // Créer le compte
      const [result]: any = await pool.query(
        'INSERT INTO users (name, email, google_id) VALUES (?, ?, ?)',
        [name, email, googleId]
      );
      const [newUser]: any = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
    }

    done(null, user);
  } catch (err: any) {
    done(err, undefined);
  }
}));

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  done(null, rows[0]);
});

// GET /api/auth/google — déclenche le OAuth Google
authGoogleRouter.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback — callback après auth Google
authGoogleRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
  (req: Request, res: Response) => {
    const user: any = req.user;
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Redirige vers le frontend avec le token en paramètre
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&id=${user.id}`);
  }
);
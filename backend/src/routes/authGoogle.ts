import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth';
import { User } from '../types';
import { MySqlUserRepository } from '../repository/userRepository';
import { MySqlGoogleAuthCodeRepository } from '../repository/googleAuthCodeRepository';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../errors/AppError';
import dotenv from 'dotenv';
dotenv.config();

export const authGoogleRouter = Router();
const userRepository = new MySqlUserRepository();
const googleAuthCodeRepository = new MySqlGoogleAuthCodeRepository();

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

  const existing = await userRepository.findByGoogleIdOrEmail(googleId, email);
  if (existing) {
    if (!(existing as any).google_id) {
      await userRepository.setGoogleId(existing.id, googleId);
    }
    return existing;
  }

  return userRepository.create({ name, email, googleId });
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
  const user = await userRepository.findById(id);
  done(null, user);
});

// GET /api/auth/google — déclenche le OAuth Google
authGoogleRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /api/auth/google/callback — callback après auth Google. Ne transmet
// plus le token JWT ni les données du profil dans l'URL de redirection :
// un code à usage unique et courte durée de vie (60s) est généré à la
// place. Le frontend l'échange ensuite contre le vrai token via
// POST /api/auth/google/exchange, qui ne transite jamais par une URL.
authGoogleRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as User;
    const code = await googleAuthCodeRepository.create(user.id);
    res.redirect(`${FRONTEND_URL}/auth/callback?code=${code}`);
  })
);

// POST /api/auth/google/exchange — échange le code temporaire contre le
// vrai token JWT. Route publique (pas de authGuard) : c'est justement ce
// qui permet au frontend de récupérer le token juste après la redirection,
// avant d'être authentifié.
authGoogleRouter.post('/google/exchange', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) throw new ValidationError('Code requis');

  const userId = await googleAuthCodeRepository.consume(code);
  if (!userId) throw new ValidationError('Code invalide ou expiré');

  const user = await userRepository.findById(userId);
  if (!user) throw new ValidationError('Code invalide ou expiré');

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: GOOGLE_TOKEN_EXPIRES }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, phone: user.phone },
  });
}));

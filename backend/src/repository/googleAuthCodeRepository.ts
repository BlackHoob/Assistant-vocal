import crypto from 'crypto';
import { pool } from '../config/db';

const CODE_TTL_SECONDS = 60;

export interface GoogleAuthCodeRepository {
  create(userId: number): Promise<string>;
  // Lit le code, le supprime immédiatement (usage unique), et renvoie le
  // userId associé — ou null si le code est inconnu ou expiré.
  consume(code: string): Promise<number | null>;
}

export class MySqlGoogleAuthCodeRepository implements GoogleAuthCodeRepository {
  async create(userId: number): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

    await pool.query(
      'INSERT INTO google_auth_codes (code, user_id, expires_at) VALUES (?, ?, ?)',
      [code, userId, expiresAt]
    );

    return code;
  }

  async consume(code: string): Promise<number | null> {
    const [rows] = await pool.query(
      'SELECT user_id, expires_at FROM google_auth_codes WHERE code = ?',
      [code]
    ) as [{ user_id: number; expires_at: Date }[], unknown];

    const row = rows[0];

    // Le code est supprimé dès sa lecture, qu'il soit valide ou non : un
    // code à usage unique ne doit jamais pouvoir être rejoué, même après
    // une tentative avec un code expiré.
    await pool.query('DELETE FROM google_auth_codes WHERE code = ?', [code]);

    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    return row.user_id;
  }
}
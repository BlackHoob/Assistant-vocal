import { MySqlGoogleAuthCodeRepository } from '../repository/googleAuthCodeRepository';
import { pool } from '../config/db';

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockedPool = pool as jest.Mocked<typeof pool>;

describe('MySqlGoogleAuthCodeRepository', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('doit insérer un code aléatoire lié à l\'utilisateur avec une expiration future', async () => {
      mockedPool.query.mockResolvedValueOnce([{}, []] as never);

      const repo = new MySqlGoogleAuthCodeRepository();
      const code = await repo.create(12);

      expect(typeof code).toBe('string');
      // crypto.randomBytes(32).toString('hex') → 64 caractères
      expect(code.length).toBe(64);

      expect(mockedPool.query).toHaveBeenCalledWith(
        'INSERT INTO google_auth_codes (code, user_id, expires_at) VALUES (?, ?, ?)',
        [code, 12, expect.any(Date)],
      );

      // L'expiration doit être dans le futur (± quelques secondes de marge)
      const call = mockedPool.query.mock.calls[0] as any;
      const expiresAt = call[1][2] as Date;
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61_000);
    });

    it('doit générer un code différent à chaque appel', async () => {
      mockedPool.query.mockResolvedValue([{}, []] as never);

      const repo = new MySqlGoogleAuthCodeRepository();
      const code1 = await repo.create(1);
      const code2 = await repo.create(1);

      expect(code1).not.toBe(code2);
    });
  });
});
 
import { stripDocumentTypePrefix } from '../routes/notifications';

// ─── Logique pure, sans dépendance ────────────────────────────────────────
describe('stripDocumentTypePrefix', () => {
  it('retire le préfixe technique "[type] " quand il est présent', () => {
    expect(stripDocumentTypePrefix('[passport] mon_passeport.pdf')).toBe('mon_passeport.pdf');
  });

  it('retire un préfixe avec un type sans espace', () => {
    expect(stripDocumentTypePrefix('[visa]fichier.pdf')).toBe('fichier.pdf');
  });

  it('laisse le nom inchangé s\'il n\'y a pas de préfixe (documents envoyés par l\'admin)', () => {
    expect(stripDocumentTypePrefix('passport')).toBe('passport');
  });

  it('ne modifie que le début de la chaîne, pas des crochets ailleurs dans le nom', () => {
    expect(stripDocumentTypePrefix('[id_card] photo [recto].pdf')).toBe('photo [recto].pdf');
  });
});

// ─── Logique avec effet de bord (accès DB) — pool mocké ───────────────────
// On simule le module config/db pour tester createNotificationIfNotRecent
// sans avoir besoin d'une vraie base MySQL.
jest.mock('../config/db', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../config/db';
import { createNotificationIfNotRecent } from '../routes/notifications';

describe('createNotificationIfNotRecent', () => {
  const mockedQuery = pool.query as jest.Mock;

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('insère la notification si aucune identique récente n\'existe', async () => {
    // 1er appel : la requête SELECT de vérification, aucune ligne trouvée
    mockedQuery.mockResolvedValueOnce([[], []]);
    // 2e appel : l'INSERT effectif dans createNotification
    mockedQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

    await createNotificationIfNotRecent(42, 'info', 'appointment', 'Rendez-vous "Consultation" le lundi');

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    // Le 2e appel doit être l'INSERT
    expect(mockedQuery.mock.calls[1][0]).toMatch(/INSERT INTO notifications/);
  });

  it('n\'insère PAS de doublon si une notification identique existe déjà (<24h)', async () => {
    // La requête de vérification trouve une ligne existante
    mockedQuery.mockResolvedValueOnce([[{ id: 99 }], []]);

    await createNotificationIfNotRecent(42, 'info', 'appointment', 'Rendez-vous "Consultation" le lundi');

    // Un seul appel (la vérification) — pas d'INSERT déclenché
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});

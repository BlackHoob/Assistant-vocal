import rateLimit, { Options } from 'express-rate-limit';

// Fabrique un limiteur de requêtes pour les routes sensibles (connexion,
// inscription, mot de passe oublié). Extrait en fonction plutôt qu'en
// instance unique pour permettre un test dédié avec des valeurs réduites
// (voir rateLimiter.test.ts), sans dépendre du comportement réel utilisé
// en production.
export function createAuthLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 tentatives par IP sur la fenêtre
    standardHeaders: true,
    legacyHeaders: false,
    // Désactivé pendant l'exécution des tests automatisés, pour ne pas
    // fausser les suites existantes qui appellent /login ou /register
    // plusieurs fois dans un même run. Le comportement du limiteur
    // lui-même reste testé séparément avec skip forcé à false.
    skip: () => process.env.NODE_ENV === 'test',
    message: { message: 'Trop de tentatives, réessayez plus tard.' },
    ...overrides,
  });
}

export const authLimiter = createAuthLimiter();
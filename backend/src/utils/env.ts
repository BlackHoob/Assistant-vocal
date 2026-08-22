import dotenv from 'dotenv';
dotenv.config();

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === 'test') {
    return `test-only-${name.toLowerCase()}`;
  }

  throw new Error(
    `Variable d'environnement manquante : ${name}. ` +
    `Vérifiez votre fichier .env (voir .env.production.example pour la liste des variables requises).`
  );
}
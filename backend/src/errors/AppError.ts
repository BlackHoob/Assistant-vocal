// Hiérarchie d'erreurs métier. Chaque route lève une de ces erreurs plutôt
// que d'appeler res.status(...).json(...) elle-même — le middleware
// errorHandler (voir middleware/errorHandler.ts) se charge de la traduire
// en réponse HTTP. Ça centralise le format de réponse d'erreur en un seul
// endroit, au lieu de le répéter dans chaque catch.
export class AppError extends Error {
  constructor(message: string, public statusCode = 500, public code?: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(message, 400, 'MISSING_FIELDS'); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') { super(message, 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') { super(message, 403, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') { super(message, 404, 'NOT_FOUND'); }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) { super(message, 409, code); }
}
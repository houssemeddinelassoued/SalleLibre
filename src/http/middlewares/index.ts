import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import type { Role, User } from '../../domain/types.js';
import { AppError, ForbiddenError, UnauthorizedError, ValidationError } from '../../errors/index.js';
import type { AuthService } from '../../services/auth-service.js';

/** Lit l'utilisateur authentifié posé par `authenticate`. */
export function currentUser(res: Response): User {
  return res.locals.user as User;
}

/** 401 sans jeton valide ; sinon pose l'utilisateur dans res.locals.user. */
export function authenticate(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();
    res.locals.user = await auth.verify(token);
    next();
  };
}

/** 403 si l'utilisateur n'a pas le rôle requis. */
export function requireRole(role: Role): RequestHandler {
  return (_req, res, next) => {
    if (currentUser(res).role !== role) throw new ForbiddenError();
    next();
  };
}

/** Valide body, params ou query ; le résultat typé est dans res.locals[source]. */
export function validate(source: 'body' | 'params' | 'query', schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new ValidationError('Requête invalide', result.error.issues);
    }
    res.locals[source] = result.data;
    next();
  };
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }
  // Erreur de JSON mal formé renvoyée par express.json().
  if (err instanceof SyntaxError) {
    res.status(400).json({ message: 'JSON invalide' });
    return;
  }
  // Erreur inattendue : jamais de détails ni de stack trace au client.
  console.error(err);
  res.status(500).json({ message: 'Erreur interne' });
};

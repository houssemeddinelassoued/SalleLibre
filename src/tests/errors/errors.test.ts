import { describe, it, expect } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../errors/index.js';

describe('erreurs métier', () => {
  it.each([
    ['ValidationError', new ValidationError(), 400],
    ['UnauthorizedError', new UnauthorizedError(), 401],
    ['ForbiddenError', new ForbiddenError(), 403],
    ['NotFoundError', new NotFoundError(), 404],
    ['ConflictError', new ConflictError(), 409],
  ])('%s porte le bon code HTTP', (name, error, status) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.name).toBe(name);
  });

  it('conserve le message et les détails', () => {
    const error = new ValidationError('Champ manquant', { field: 'name' });
    expect(error.message).toBe('Champ manquant');
    expect(error.details).toEqual({ field: 'name' });
  });
});

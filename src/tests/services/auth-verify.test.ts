import jwt from 'jsonwebtoken';
import { describe, it, expect } from 'vitest';
import { UnauthorizedError } from '../../errors/index.js';
import { InMemoryUserRepository } from '../../repositories/in-memory.js';
import { AuthService } from '../../services/auth-service.js';

const config = { jwtSecret: 'secret-de-test', tokenTtlSeconds: 60 };

describe('AuthService.verify · jeton sans sujet', () => {
  it('refuse un jeton valide signé mais sans claim sub (401)', async () => {
    const auth = new AuthService(new InMemoryUserRepository(), config);
    await auth.register('alice', 'motdepasse1');
    const noSubject = jwt.sign({ role: 'admin' }, config.jwtSecret);
    await expect(auth.verify(noSubject)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

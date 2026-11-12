import jwt from 'jsonwebtoken';
import { describe, it, expect } from 'vitest';
import { ConflictError, UnauthorizedError, ValidationError } from '../../errors/index.js';
import { InMemoryUserRepository } from '../../repositories/in-memory.js';
import { AuthService } from '../../services/auth-service.js';
import { hashPassword, verifyPassword } from '../../services/password.js';

const config = { jwtSecret: 'secret-de-test', tokenTtlSeconds: 60 };
const setup = () => new AuthService(new InMemoryUserRepository(), config);

describe('password', () => {
  it('vérifie le bon mot de passe et refuse le mauvais', () => {
    const hash = hashPassword('motdepasse1');
    expect(verifyPassword('motdepasse1', hash)).toBe(true);
    expect(verifyPassword('autre-chose', hash)).toBe(false);
  });

  it('ne stocke pas le mot de passe en clair et sale chaque hash', () => {
    const a = hashPassword('motdepasse1');
    expect(a).not.toContain('motdepasse1');
    expect(a).not.toBe(hashPassword('motdepasse1'));
  });
});

describe('AuthService', () => {
  it('inscrit puis connecte un utilisateur, et vérifie son jeton', async () => {
    const auth = setup();
    const user = await auth.register('alice', 'motdepasse1', 'admin');
    const token = await auth.login('alice', 'motdepasse1');
    expect(await auth.verify(token)).toEqual(user);
  });

  it('refuse un nom déjà pris (409) et un mot de passe trop court (400)', async () => {
    const auth = setup();
    await auth.register('alice', 'motdepasse1');
    await expect(auth.register('alice', 'motdepasse1')).rejects.toBeInstanceOf(ConflictError);
    await expect(auth.register('bob', 'court')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un mauvais mot de passe ou un nom inconnu (401)', async () => {
    const auth = setup();
    await auth.register('alice', 'motdepasse1');
    await expect(auth.login('alice', 'mauvais-mdp')).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(auth.login('inconnu', 'motdepasse1')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuse un jeton falsifié, expiré ou d’un utilisateur inconnu (401)', async () => {
    const auth = setup();
    const user = await auth.register('alice', 'motdepasse1');
    const forged = jwt.sign({}, 'autre-secret', { subject: user.id });
    const expired = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: -10 });
    const ghost = jwt.sign({}, config.jwtSecret, { subject: 'fantome' });
    for (const token of ['pas-un-jeton', forged, expired, ghost]) {
      await expect(auth.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../services/password.js';

describe('verifyPassword · entrées mal formées', () => {
  const malformed = [
    ['chaîne vide', ''],
    ['sans séparateur', 'abcdef'],
    ['sel vide', ':abcdef'],
    ['hash vide', 'abcdef:'],
    ['séparateur seul', ':'],
  ];

  it.each(malformed)('refuse un hash %s (false, sans lever d’erreur)', (_label, stored) => {
    expect(verifyPassword('motdepasse1', stored)).toBe(false);
  });

  it('refuse un hash dont le sel est valide mais le hash altéré', () => {
    const good = hashPassword('motdepasse1');
    const [salt] = good.split(':');
    const altered = `${salt}:${'00'.repeat(64)}`;
    expect(verifyPassword('motdepasse1', altered)).toBe(false);
  });
});

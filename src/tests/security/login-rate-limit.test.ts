import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';

// Faille F2 : /auth/login n'a aucune limite de tentatives : brute force illimité.

let app: ReturnType<typeof createApp>;
let services: ReturnType<typeof buildServices>;

const login = (name: string, password: string) =>
  request(app).post('/api/auth/login').send({ name, password });

beforeEach(async () => {
  services = buildServices({ jwtSecret: 'secret-de-test-assez-long', tokenTtlSeconds: 60 });
  app = createApp(services);
  await services.auth.register('alice', 'motdepasse1', 'membre');
  await services.auth.register('bob', 'motdepasse2', 'membre');
});

describe('sécurité · F2 limite de tentatives de connexion', () => {
  it('429 après 5 échecs sur un même compte, même avec le bon mot de passe ensuite', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login('alice', 'mauvais-mdp')).status).toBe(401);
    }

    expect((await login('alice', 'mauvais-mdp')).status).toBe(429);
    expect((await login('alice', 'motdepasse1')).status).toBe(429);
  });

  it('un échec sur alice ne bloque pas la connexion de bob', async () => {
    for (let i = 0; i < 5; i++) {
      await login('alice', 'mauvais-mdp');
    }

    expect((await login('bob', 'motdepasse2')).status).toBe(200);
  });
});

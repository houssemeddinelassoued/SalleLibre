import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';

// Faille F3 : entrées sans borne de taille ni de cardinal (consommation de ressources).

const iso = (hh: number): string => new Date(Date.UTC(2026, 10, 12, hh)).toISOString();

let app: ReturnType<typeof createApp>;
let adminToken: string;
let aliceToken: string;

beforeEach(async () => {
  const services = buildServices(
    { jwtSecret: 'secret-de-test-assez-long', tokenTtlSeconds: 60 },
    () => new Date(Date.UTC(2026, 10, 12, 8)),
  );
  app = createApp(services);
  await services.auth.register('admin', 'motdepasse1', 'admin');
  await services.auth.register('alice', 'motdepasse1', 'membre');
  adminToken = (await request(app).post('/api/auth/login').send({ name: 'admin', password: 'motdepasse1' })).body.token;
  aliceToken = (await request(app).post('/api/auth/login').send({ name: 'alice', password: 'motdepasse1' })).body.token;
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('sécurité · F3 bornes sur les entrées', () => {
  it.each([
    ['nom de salle de 101 caractères', (): object => ({ name: 'a'.repeat(101), capacity: 6 })],
    ['21 équipements', (): object => ({ name: 'Atlas', capacity: 6, equipment: Array(21).fill('x') })],
    ['équipement de 51 caractères', (): object => ({ name: 'Atlas', capacity: 6, equipment: ['e'.repeat(51)] })],
  ])('400 pour une salle : %s', async (_label, build) => {
    const res = await request(app).post('/api/rooms').set(auth(adminToken)).send(build());

    expect(res.status).toBe(400);
  });

  it('400 pour un sujet de réservation de 201 caractères', async () => {
    const room = await request(app).post('/api/rooms').set(auth(adminToken)).send({ name: 'Atlas', capacity: 6 });

    const res = await request(app).post('/api/bookings').set(auth(aliceToken)).send({
      roomId: room.body.id,
      start: iso(10),
      end: iso(11),
      subject: 's'.repeat(201),
    });

    expect(res.status).toBe(400);
  });

  it('400 pour un mot de passe de 129 caractères à l’inscription', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'carol', password: 'p'.repeat(129) });

    expect(res.status).toBe(400);
  });
});

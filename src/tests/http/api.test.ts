import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';
import { loadConfig } from '../../config/env.js';

// Horloge fixe : 12 nov 2026, 08h UTC.
const iso = (hh: number, mm = 0): string => new Date(Date.UTC(2026, 10, 12, hh, mm)).toISOString();

let app: ReturnType<typeof createApp>;
let adminToken: string;
let aliceToken: string;
let bobToken: string;

async function tokenFor(name: string, role: 'admin' | 'membre'): Promise<string> {
  await services.auth.register(name, 'motdepasse1', role);
  const res = await request(app).post('/api/auth/login').send({ name, password: 'motdepasse1' });
  return res.body.token as string;
}

let services: ReturnType<typeof buildServices>;

beforeEach(async () => {
  services = buildServices(
    { jwtSecret: 'secret-de-test-assez-long', tokenTtlSeconds: 60 },
    () => new Date(Date.UTC(2026, 10, 12, 8)),
  );
  app = createApp(services);
  adminToken = await tokenFor('admin', 'admin');
  aliceToken = await tokenFor('alice', 'membre');
  bobToken = await tokenFor('bob', 'membre');
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createRoom(): Promise<string> {
  const res = await request(app).post('/api/rooms').set(auth(adminToken)).send({ name: 'Atlas', capacity: 6 });
  return res.body.id as string;
}

describe('authentification', () => {
  it('401 sans jeton ou avec un jeton invalide', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(401);
    expect((await request(app).get('/api/rooms').set(auth('faux'))).status).toBe(401);
    expect((await request(app).get('/api/bookings/mine')).status).toBe(401);
  });

  it('login : 401 sur mauvais mot de passe, 400 sur corps invalide', async () => {
    const bad = await request(app).post('/api/auth/login').send({ name: 'alice', password: 'mauvais-mdp' });
    expect(bad.status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  it('inscription publique : crée un membre, jamais un admin, sans mot de passe dans la réponse', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'carol', password: 'motdepasse1', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('membre');
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    expect((await request(app).post('/api/auth/register').send({ name: 'carol', password: 'motdepasse1' })).status).toBe(409);
  });
});

describe('salles', () => {
  it('403 pour un membre, 201 pour un admin', async () => {
    const body = { name: 'Atlas', capacity: 6 };
    expect((await request(app).post('/api/rooms').set(auth(aliceToken)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/rooms').set(auth(adminToken)).send(body)).status).toBe(201);
  });

  it('403 pour un membre sur PUT et DELETE', async () => {
    const id = await createRoom();
    const body = { name: 'X', capacity: 2 };
    expect((await request(app).put(`/api/rooms/${id}`).set(auth(aliceToken)).send(body)).status).toBe(403);
    expect((await request(app).delete(`/api/rooms/${id}`).set(auth(aliceToken))).status).toBe(403);
  });

  it('CRUD admin : liste, modification, suppression (204), puis 404', async () => {
    const id = await createRoom();
    expect((await request(app).get('/api/rooms').set(auth(aliceToken))).body).toHaveLength(1);
    const put = await request(app).put(`/api/rooms/${id}`).set(auth(adminToken)).send({ name: 'Atlas', capacity: 8 });
    expect(put.body.capacity).toBe(8);
    expect((await request(app).delete(`/api/rooms/${id}`).set(auth(adminToken))).status).toBe(204);
    expect((await request(app).delete(`/api/rooms/${id}`).set(auth(adminToken))).status).toBe(404);
  });

  it('400 sur entrée invalide, avec détails', async () => {
    const res = await request(app).post('/api/rooms').set(auth(adminToken)).send({ name: 'X', capacity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
    expect(res.body.details).toBeDefined();
  });

  it('disponibilité : exclut une salle réservée, valide la query', async () => {
    const id = await createRoom();
    await request(app).post('/api/bookings').set(auth(aliceToken))
      .send({ roomId: id, start: iso(10), end: iso(11), subject: 'Revue' });
    const busy = await request(app).get('/api/rooms/available').query({ start: iso(10), end: iso(11) }).set(auth(bobToken));
    expect(busy.body).toEqual([]);
    const free = await request(app).get('/api/rooms/available').query({ start: iso(11), end: iso(12) }).set(auth(bobToken));
    expect(free.body).toHaveLength(1);
    const bad = await request(app).get('/api/rooms/available').query({ start: 'hier' }).set(auth(bobToken));
    expect(bad.status).toBe(400);
  });
});

describe('réservations', () => {
  const booking = (roomId: string, a: number, b: number) => ({ roomId, start: iso(a), end: iso(b), subject: 'Revue' });

  it('201 puis 409 sur chevauchement, 201 bout à bout', async () => {
    const id = await createRoom();
    expect((await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(id, 10, 11))).status).toBe(201);
    const conflict = await request(app).post('/api/bookings').set(auth(bobToken)).send({ ...booking(id, 10, 11), start: iso(10, 30), end: iso(11, 30) });
    expect(conflict.status).toBe(409);
    expect((await request(app).post('/api/bookings').set(auth(bobToken)).send(booking(id, 11, 12))).status).toBe(201);
  });

  it('401 sans jeton, 400 si fin avant début, 404 salle inconnue', async () => {
    const id = await createRoom();
    expect((await request(app).post('/api/bookings').send(booking(id, 10, 11))).status).toBe(401);
    expect((await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(id, 11, 10))).status).toBe(400);
    expect((await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking('nope', 10, 11))).status).toBe(404);
  });

  it('annulation : 403 pour un autre membre, 204 pour le propriétaire et pour un admin', async () => {
    const id = await createRoom();
    const first = await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(id, 10, 11));
    const second = await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(id, 12, 13));
    expect((await request(app).delete(`/api/bookings/${first.body.id}`).set(auth(bobToken))).status).toBe(403);
    expect((await request(app).delete(`/api/bookings/${first.body.id}`).set(auth(aliceToken))).status).toBe(204);
    expect((await request(app).delete(`/api/bookings/${second.body.id}`).set(auth(adminToken))).status).toBe(204);
  });

  it('GET /bookings/mine ne renvoie que ses réservations', async () => {
    const id = await createRoom();
    await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(id, 10, 11));
    await request(app).post('/api/bookings').set(auth(bobToken)).send(booking(id, 12, 13));
    const mine = await request(app).get('/api/bookings/mine').set(auth(aliceToken));
    expect(mine.body).toHaveLength(1);
  });
});

describe('robustesse', () => {
  it('route inconnue : 401 sans jeton, 404 avec ; 400 sur JSON mal formé', async () => {
    expect((await request(app).get('/api/inconnu')).status).toBe(401);
    expect((await request(app).get('/api/inconnu').set(auth(aliceToken))).status).toBe(404);
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{pas du json');
    expect(res.status).toBe(400);
  });
});

describe('config', () => {
  it('refuse de démarrer sans JWT_SECRET', () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
    expect(loadConfig({ JWT_SECRET: 'x'.repeat(16) }).port).toBe(3000);
  });
});

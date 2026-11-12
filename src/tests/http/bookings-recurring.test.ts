import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';

// Horloge fixe : 12 nov 2026, 08h UTC. Les mardis suivants sont dans le futur.
const iso = (jour: number, hh: number, mm = 0): string =>
  new Date(Date.UTC(2026, 10, jour, hh, mm)).toISOString();

let app: ReturnType<typeof createApp>;
let services: ReturnType<typeof buildServices>;
let aliceToken: string;
let bobToken: string;
let roomId: string;

async function tokenFor(name: string, role: 'admin' | 'membre'): Promise<string> {
  await services.auth.register(name, 'motdepasse1', role);
  const res = await request(app).post('/api/auth/login').send({ name, password: 'motdepasse1' });
  return res.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  services = buildServices(
    { jwtSecret: 'secret-de-test-assez-long', tokenTtlSeconds: 60 },
    () => new Date(Date.UTC(2026, 10, 12, 8)),
  );
  app = createApp(services);
  const adminToken = await tokenFor('admin', 'admin');
  aliceToken = await tokenFor('alice', 'membre');
  bobToken = await tokenFor('bob', 'membre');
  const room = await request(app).post('/api/rooms').set(auth(adminToken)).send({ name: 'Atlas', capacity: 6 });
  roomId = room.body.id as string;
});

const serie = (extra: Record<string, unknown> = {}) => ({
  roomId,
  start: iso(17, 10),
  end: iso(17, 11),
  untilDay: '2026-12-01',
  exceptions: [],
  subject: 'Point hebdo',
  ...extra,
});

describe('POST /api/bookings/recurring', () => {
  it('201 : une réservation par semaine, au nom de l’appelant', async () => {
    const res = await request(app).post('/api/bookings/recurring').set(auth(aliceToken)).send(serie());

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
    expect(res.body.every((b: { ownerId: string }) => b.ownerId)).toBe(true);
    const mine = await request(app).get('/api/bookings/mine').set(auth(aliceToken));
    expect(mine.body).toHaveLength(3);
  });

  it('409 si une occurrence est prise, et aucune réservation d’Alice n’est créée', async () => {
    await request(app)
      .post('/api/bookings')
      .set(auth(bobToken))
      .send({ roomId, start: iso(24, 10), end: iso(24, 11), subject: 'Autre' });

    const res = await request(app).post('/api/bookings/recurring').set(auth(aliceToken)).send(serie());

    expect(res.status).toBe(409);
    const mine = await request(app).get('/api/bookings/mine').set(auth(aliceToken));
    expect(mine.body).toHaveLength(0);
  });

  it('201 en sautant une date d’exception occupée', async () => {
    await request(app)
      .post('/api/bookings')
      .set(auth(bobToken))
      .send({ roomId, start: iso(24, 10), end: iso(24, 11), subject: 'Autre' });

    const res = await request(app)
      .post('/api/bookings/recurring')
      .set(auth(aliceToken))
      .send(serie({ exceptions: ['2026-11-24'] }));

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
  });

  it('400 : date limite mal formée, exceptions en trop, fin avant début', async () => {
    const send = (body: Record<string, unknown>) =>
      request(app).post('/api/bookings/recurring').set(auth(aliceToken)).send(body);

    expect((await send(serie({ untilDay: '01/12/2026' }))).status).toBe(400);
    expect((await send(serie({ end: iso(17, 9) }))).status).toBe(400);
    const trop = Array.from({ length: 27 }, (_, i) => `2026-11-${String(i % 28 + 1).padStart(2, '0')}`);
    expect((await send(serie({ exceptions: trop }))).status).toBe(400);
  });

  it('400 : plus de 26 occurrences', async () => {
    const res = await request(app)
      .post('/api/bookings/recurring')
      .set(auth(aliceToken))
      .send(serie({ untilDay: '2027-12-31' }));

    expect(res.status).toBe(400);
  });

  it('404 pour une salle inconnue', async () => {
    const res = await request(app)
      .post('/api/bookings/recurring')
      .set(auth(aliceToken))
      .send(serie({ roomId: 'absente' }));

    expect(res.status).toBe(404);
  });

  it('401 sans jeton', async () => {
    expect((await request(app).post('/api/bookings/recurring').send(serie())).status).toBe(401);
  });
});

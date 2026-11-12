import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildServices, createApp } from '../../app.js';

// Horloge fixe : 12 nov 2026, 08h UTC.
const iso = (hh: number, mm = 0): string => new Date(Date.UTC(2026, 10, 12, hh, mm)).toISOString();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let app: ReturnType<typeof createApp>;
let services: ReturnType<typeof buildServices>;
let adminToken: string;
let aliceToken: string;
let bobToken: string;

async function tokenFor(name: string, role: 'admin' | 'membre'): Promise<string> {
  await services.auth.register(name, 'motdepasse1', role);
  const res = await request(app).post('/api/auth/login').send({ name, password: 'motdepasse1' });
  return res.body.token as string;
}

async function createRoom(): Promise<string> {
  const res = await request(app).post('/api/rooms').set(auth(adminToken)).send({ name: 'Atlas', capacity: 6 });
  return res.body.id as string;
}

const booking = (roomId: string, a: number, b: number, subject = 'Revue') => ({
  roomId,
  start: iso(a),
  end: iso(b),
  subject,
});

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

describe('scénarios d’intégration · réservations', () => {
  it('parcours complet : réserver, la salle disparaît des disponibilités, annuler, elle revient', async () => {
    const roomId = await createRoom();
    const query = `/api/rooms/available?start=${encodeURIComponent(iso(10))}&end=${encodeURIComponent(iso(11))}&minCapacity=1`;

    expect((await request(app).get(query).set(auth(aliceToken))).body.map((r: { id: string }) => r.id)).toContain(roomId);

    const created = await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(roomId, 10, 11));
    expect(created.status).toBe(201);

    expect((await request(app).get(query).set(auth(aliceToken))).body.map((r: { id: string }) => r.id)).not.toContain(roomId);

    expect((await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(aliceToken))).status).toBe(204);

    expect((await request(app).get(query).set(auth(aliceToken))).body.map((r: { id: string }) => r.id)).toContain(roomId);
  });

  it('403 : un membre ne peut pas supprimer la réservation d’un autre, qui reste en place', async () => {
    const roomId = await createRoom();
    const alice = await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(roomId, 10, 11));

    const forbidden = await request(app).delete(`/api/bookings/${alice.body.id}`).set(auth(bobToken));
    expect(forbidden.status).toBe(403);

    const mine = await request(app).get('/api/bookings/mine').set(auth(aliceToken));
    expect(mine.body.map((b: { id: string }) => b.id)).toEqual([alice.body.id]);
  });

  it('409 puis libération : après annulation par un admin, le créneau se réserve à nouveau', async () => {
    const roomId = await createRoom();
    const alice = await request(app).post('/api/bookings').set(auth(aliceToken)).send(booking(roomId, 10, 11));

    const conflict = await request(app).post('/api/bookings').set(auth(bobToken)).send(booking(roomId, 10, 11));
    expect(conflict.status).toBe(409);

    expect((await request(app).delete(`/api/bookings/${alice.body.id}`).set(auth(adminToken))).status).toBe(204);

    const retry = await request(app).post('/api/bookings').set(auth(bobToken)).send(booking(roomId, 10, 11));
    expect(retry.status).toBe(201);
  });
});

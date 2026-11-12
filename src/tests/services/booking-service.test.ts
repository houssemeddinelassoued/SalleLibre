import { describe, it, expect } from 'vitest';
import type { Room, User } from '../../domain/types.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../errors/index.js';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
} from '../../repositories/in-memory.js';
import { BookingService } from '../../services/booking-service.js';

const alice: User = { id: 'u1', name: 'alice', role: 'membre' };
const bob: User = { id: 'u2', name: 'bob', role: 'membre' };
const admin: User = { id: 'a1', name: 'admin', role: 'admin' };
const atlas: Room = { id: 'r1', name: 'Atlas', capacity: 6, equipment: [] };

// Horloge fixe : 12 nov 2026, 08h UTC.
const h = (hh: number, mm = 0): Date => new Date(Date.UTC(2026, 10, 12, hh, mm));
const slot = (a: Date, b: Date) => ({ start: a, end: b });

async function setup() {
  const rooms = new InMemoryRoomRepository();
  await rooms.save(atlas);
  const bookings = new InMemoryBookingRepository();
  return { bookings, service: new BookingService(rooms, bookings, () => h(8)) };
}

describe('BookingService.book', () => {
  it('crée une réservation au nom de l’utilisateur', async () => {
    const { service } = await setup();
    const b = await service.book(alice, atlas.id, slot(h(10), h(11)), 'Revue');
    expect(b).toMatchObject({ roomId: atlas.id, ownerId: alice.id, subject: 'Revue' });
  });

  it.each([
    ['partiel', slot(h(10, 30), h(11, 30))],
    ['identique', slot(h(10), h(11))],
    ['inclusion', slot(h(9), h(12))],
  ])('refuse un chevauchement %s (409)', async (_label, other) => {
    const { service } = await setup();
    await service.book(alice, atlas.id, slot(h(10), h(11)), 'Revue');
    await expect(service.book(bob, atlas.id, other, 'Autre')).rejects.toBeInstanceOf(ConflictError);
  });

  it('accepte des créneaux bout à bout', async () => {
    const { service } = await setup();
    await service.book(alice, atlas.id, slot(h(10), h(11)), 'A');
    await expect(service.book(bob, atlas.id, slot(h(11), h(12)), 'B')).resolves.toBeDefined();
    await expect(service.book(bob, atlas.id, slot(h(9), h(10)), 'C')).resolves.toBeDefined();
  });

  it.each([
    ['fin avant début', slot(h(11), h(10)), 'Sujet'],
    ['durée nulle', slot(h(10), h(10)), 'Sujet'],
    ['créneau passé', slot(h(6), h(7)), 'Sujet'],
    ['sujet vide', slot(h(10), h(11)), '  '],
  ])('refuse : %s (400)', async (_label, s, subject) => {
    const { service } = await setup();
    await expect(service.book(alice, atlas.id, s, subject)).rejects.toBeInstanceOf(ValidationError);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const { service } = await setup();
    await expect(service.book(alice, 'nope', slot(h(10), h(11)), 'x')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('BookingService.cancel', () => {
  it('le propriétaire libère sa réservation, le créneau redevient libre', async () => {
    const { service } = await setup();
    const b = await service.book(alice, atlas.id, slot(h(10), h(11)), 'Revue');
    await service.cancel(alice, b.id);
    await expect(service.book(bob, atlas.id, slot(h(10), h(11)), 'B')).resolves.toBeDefined();
  });

  it('un autre membre reçoit 403, un admin peut annuler', async () => {
    const { service, bookings } = await setup();
    const b = await service.book(alice, atlas.id, slot(h(10), h(11)), 'Revue');
    await expect(service.cancel(bob, b.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await bookings.findById(b.id)).toBeDefined();
    await service.cancel(admin, b.id);
    expect(await bookings.findById(b.id)).toBeUndefined();
  });

  it('renvoie 404 pour une réservation inconnue', async () => {
    const { service } = await setup();
    await expect(service.cancel(alice, 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('BookingService.listMine', () => {
  it('ne renvoie que les réservations de l’utilisateur', async () => {
    const { service } = await setup();
    await service.book(alice, atlas.id, slot(h(10), h(11)), 'A');
    await service.book(bob, atlas.id, slot(h(12), h(13)), 'B');
    const mine = await service.listMine(alice);
    expect(mine.map((b) => b.subject)).toEqual(['A']);
  });
});

// Cas validés dans src/tests/CASES.md (Q1 à Q4).
describe('BookingService · cas validés (CASES.md)', () => {
  it('Q1 : accepte un créneau qui commence exactement à maintenant', async () => {
    const { service } = await setup(); // now = 08h
    await expect(service.book(alice, atlas.id, slot(h(8), h(9)), 'Tôt')).resolves.toBeDefined();
  });

  it('Q2 : n’impose aucune longueur maximale au sujet', async () => {
    const { service } = await setup();
    const longSubject = 'x'.repeat(5000);
    await expect(service.book(alice, atlas.id, slot(h(10), h(11)), longSubject)).resolves.toMatchObject({
      subject: longSubject,
    });
  });

  it('Q3 : créneau invalide ET salle inconnue → 400, la validation passe avant la salle', async () => {
    const { service } = await setup();
    await expect(service.book(alice, 'nope', slot(h(11), h(10)), 'x')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.book(alice, 'nope', slot(h(6), h(7)), 'x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('Q4 : un admin ne peut pas réserver sur un créneau déjà pris (409)', async () => {
    const { service } = await setup();
    await service.book(alice, atlas.id, slot(h(10), h(11)), 'Revue');
    await expect(service.book(admin, atlas.id, slot(h(10), h(11)), 'Admin')).rejects.toBeInstanceOf(ConflictError);
  });
});

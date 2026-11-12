import { describe, it, expect } from 'vitest';
import type { Room, User } from '../../domain/types.js';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/index.js';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
} from '../../repositories/in-memory.js';
import { BookingService } from '../../services/booking-service.js';

const alice: User = { id: 'u1', name: 'alice', role: 'membre' };
const bob: User = { id: 'u2', name: 'bob', role: 'membre' };
const atlas: Room = { id: 'r1', name: 'Atlas', capacity: 6, equipment: [] };

// Horloge fixe : 12 nov 2026, 08h UTC. Les mardis suivants sont dans le futur.
const h = (jour: number, hh: number, mm = 0): Date =>
  new Date(Date.UTC(2026, 10, jour, hh, mm));
const slot = (a: Date, b: Date) => ({ start: a, end: b });

async function setup() {
  const rooms = new InMemoryRoomRepository();
  await rooms.save(atlas);
  const bookings = new InMemoryBookingRepository();
  return { bookings, service: new BookingService(rooms, bookings, () => h(12, 8)) };
}

describe('BookingService.bookWeekly', () => {
  it('crée une réservation par semaine jusqu’au jour limite, au nom de l’utilisateur', async () => {
    const { bookings, service } = await setup();

    const crees = await service.bookWeekly(alice, atlas.id, slot(h(17, 10), h(17, 11)), '2026-12-01', [], 'Point');

    expect(crees.map((b) => b.start.toISOString())).toEqual([
      '2026-11-17T10:00:00.000Z',
      '2026-11-24T10:00:00.000Z',
      '2026-12-01T10:00:00.000Z',
    ]);
    expect(crees.every((b) => b.ownerId === alice.id && b.subject === 'Point')).toBe(true);
    expect(await bookings.findByRoom(atlas.id)).toHaveLength(3);
  });

  it('refuse tout ou rien : un seul conflit, aucune réservation créée', async () => {
    const { bookings, service } = await setup();
    await service.book(bob, atlas.id, slot(h(24, 10), h(24, 11)), 'Autre');

    await expect(
      service.bookWeekly(alice, atlas.id, slot(h(17, 10), h(17, 11)), '2026-12-01', [], 'Point'),
    ).rejects.toBeInstanceOf(ConflictError);

    // Seule la réservation de Bob existe : aucune occurrence d'Alice n'a été écrite.
    const existantes = await bookings.findByRoom(atlas.id);
    expect(existantes).toHaveLength(1);
    expect(existantes[0].ownerId).toBe(bob.id);
  });

  it('saute une date d’exception, donc n’est pas bloquée par la réservation de ce jour-là', async () => {
    const { service } = await setup();
    await service.book(bob, atlas.id, slot(h(24, 10), h(24, 11)), 'Autre');

    const crees = await service.bookWeekly(
      alice,
      atlas.id,
      slot(h(17, 10), h(17, 11)),
      '2026-12-01',
      ['2026-11-24'],
      'Point',
    );

    expect(crees.map((b) => b.start.toISOString())).toEqual([
      '2026-11-17T10:00:00.000Z',
      '2026-12-01T10:00:00.000Z',
    ]);
  });

  it('refuse une occurrence dans le passé, sans rien écrire', async () => {
    const { bookings, service } = await setup();

    // Le premier mardi est le 10 nov, avant l'horloge (12 nov).
    await expect(
      service.bookWeekly(alice, atlas.id, slot(h(10, 10), h(10, 11)), '2026-11-24', [], 'Point'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await bookings.findByRoom(atlas.id)).toHaveLength(0);
  });

  it('refuse plus de 26 occurrences', async () => {
    const { service } = await setup();

    await expect(
      service.bookWeekly(alice, atlas.id, slot(h(17, 10), h(17, 11)), '2027-12-31', [], 'Point'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse une série sans aucune occurrence', async () => {
    const { service } = await setup();

    await expect(
      service.bookWeekly(alice, atlas.id, slot(h(17, 10), h(17, 11)), '2026-11-18', ['2026-11-17'], 'Point'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const { service } = await setup();

    await expect(
      service.bookWeekly(alice, 'absente', slot(h(17, 10), h(17, 11)), '2026-12-01', [], 'Point'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deux séries concurrentes sur les mêmes créneaux : une seule réussit, sans écriture partielle', async () => {
    const { bookings, service } = await setup();
    const creneau = slot(h(17, 10), h(17, 11));

    const resultats = await Promise.allSettled([
      service.bookWeekly(alice, atlas.id, creneau, '2026-12-01', [], 'A'),
      service.bookWeekly(bob, atlas.id, creneau, '2026-12-01', [], 'B'),
    ]);

    const reussies = resultats.filter((r) => r.status === 'fulfilled');
    const echouees = resultats.filter((r) => r.status === 'rejected');
    expect(reussies).toHaveLength(1);
    expect(echouees).toHaveLength(1);
    expect((echouees[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect(await bookings.findByRoom(atlas.id)).toHaveLength(3);
  });
});

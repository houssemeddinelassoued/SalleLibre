import { describe, expect, it } from 'vitest';
import type { Room, User } from '../../domain/types.js';
import { ConflictError } from '../../errors/index.js';
import { InMemoryBookingRepository, InMemoryRoomRepository } from '../../repositories/in-memory.js';
import { BookingService } from '../../services/booking-service.js';

// Faille F1 : la vérification de chevauchement et l'enregistrement ne sont pas
// atomiques ; deux requêtes concurrentes peuvent réserver le même créneau.

const now = new Date(Date.UTC(2026, 10, 12, 8));
const h = (hh: number): Date => new Date(Date.UTC(2026, 10, 12, hh));
const atlas: Room = { id: 'r1', name: 'Atlas', capacity: 6, equipment: [] };
const alice: User = { id: 'u1', name: 'alice', role: 'membre' };
const bob: User = { id: 'u2', name: 'bob', role: 'membre' };

describe('sécurité · F1 double réservation concurrente', () => {
  it('refuse que deux réservations concurrentes occupent le même créneau', async () => {
    const rooms = new InMemoryRoomRepository();
    await rooms.save(atlas);
    const service = new BookingService(rooms, new InMemoryBookingRepository(), () => now);
    const slot = { start: h(10), end: h(11) };

    const results = await Promise.allSettled([
      service.book(alice, 'r1', slot, 'Point'),
      service.book(bob, 'r1', slot, 'Revue'),
    ]);

    const accepted = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
  });
});

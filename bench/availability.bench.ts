import { bench, describe } from 'vitest';
import { findAvailableRooms } from '../src/domain/availability.js';
import type { Booking, Room, Slot } from '../src/domain/types.js';

// Jeu déterministe : 300 salles, 5 000 réservations réparties sur la journée.
const base = Date.UTC(2026, 10, 12, 8);
const MIN = 60_000;

const rooms: Room[] = Array.from({ length: 300 }, (_, i) => ({
  id: `r${i}`,
  name: `Salle ${i}`,
  capacity: 1 + (i % 40),
  equipment: [],
}));

const bookings: Booking[] = Array.from({ length: 5000 }, (_, i) => {
  const start = new Date(base + (i % 240) * 30 * MIN);
  const end = new Date(start.getTime() + 60 * MIN);
  return { id: `b${i}`, roomId: `r${i % 300}`, ownerId: 'u', subject: 's', start, end };
});

const slot: Slot = {
  start: new Date(base + 100 * 30 * MIN),
  end: new Date(base + 102 * 30 * MIN),
};

describe('findAvailableRooms · 300 salles, 5 000 réservations', () => {
  bench('créneau d’une heure, capacité minimale 10', () => {
    findAvailableRooms(rooms, bookings, slot, 10);
  });
});

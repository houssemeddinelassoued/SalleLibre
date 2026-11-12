import { describe, it, expect } from 'vitest';
import type { Booking, Room } from '../../domain/types.js';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
  InMemoryUserRepository,
} from '../../repositories/in-memory.js';

const room = (id: string): Room => ({ id, name: `Salle ${id}`, capacity: 4, equipment: [] });
const booking = (id: string, roomId: string, ownerId: string): Booking => ({
  id,
  roomId,
  ownerId,
  subject: 'Réunion',
  start: new Date(Date.UTC(2026, 10, 12, 10)),
  end: new Date(Date.UTC(2026, 10, 12, 11)),
});

describe('InMemoryRoomRepository', () => {
  it('enregistre, retrouve et liste les salles', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.save(room('a'));
    await repo.save(room('b'));
    expect(await repo.findById('a')).toEqual(room('a'));
    expect(await repo.findAll()).toHaveLength(2);
  });

  it('remplace une salle de même id', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.save(room('a'));
    await repo.save({ ...room('a'), capacity: 10 });
    expect((await repo.findAll())).toHaveLength(1);
    expect((await repo.findById('a'))?.capacity).toBe(10);
  });

  it('supprime et signale une salle absente', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.save(room('a'));
    expect(await repo.delete('a')).toBe(true);
    expect(await repo.delete('a')).toBe(false);
    expect(await repo.findById('a')).toBeUndefined();
  });
});

describe('InMemoryBookingRepository', () => {
  it('filtre par salle et par propriétaire', async () => {
    const repo = new InMemoryBookingRepository();
    await repo.save(booking('1', 'a', 'u1'));
    await repo.save(booking('2', 'a', 'u2'));
    await repo.save(booking('3', 'b', 'u1'));
    expect((await repo.findByRoom('a')).map((b) => b.id)).toEqual(['1', '2']);
    expect((await repo.findByOwner('u1')).map((b) => b.id)).toEqual(['1', '3']);
  });

  it('retrouve et supprime une réservation', async () => {
    const repo = new InMemoryBookingRepository();
    await repo.save(booking('1', 'a', 'u1'));
    expect((await repo.findById('1'))?.roomId).toBe('a');
    expect(await repo.delete('1')).toBe(true);
    expect(await repo.delete('1')).toBe(false);
  });
});

describe('InMemoryUserRepository', () => {
  it('retrouve un utilisateur par nom et par id', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save({ id: 'u1', name: 'alice', role: 'admin', passwordHash: 'x' });
    expect((await repo.findByName('alice'))?.id).toBe('u1');
    expect((await repo.findById('u1'))?.name).toBe('alice');
    expect(await repo.findByName('bob')).toBeUndefined();
  });
});

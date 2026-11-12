import { describe, it, expect } from 'vitest';
import type { User } from '../../domain/types.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../errors/index.js';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
} from '../../repositories/in-memory.js';
import { RoomService } from '../../services/room-service.js';

const admin: User = { id: 'a1', name: 'admin', role: 'admin' };
const membre: User = { id: 'm1', name: 'membre', role: 'membre' };
const h = (hh: number): Date => new Date(Date.UTC(2026, 10, 12, hh));

function setup() {
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  return { rooms, bookings, service: new RoomService(rooms, bookings) };
}

describe('RoomService · droits admin', () => {
  it('un admin crée, modifie et supprime une salle', async () => {
    const { service } = setup();
    const room = await service.create(admin, { name: 'Atlas', capacity: 6 });
    expect(await service.list()).toEqual([room]);
    const updated = await service.update(admin, room.id, { name: 'Atlas', capacity: 8 });
    expect(updated.capacity).toBe(8);
    await service.remove(admin, room.id);
    expect(await service.list()).toEqual([]);
  });

  it('un membre reçoit 403 sur create, update et remove', async () => {
    const { service } = setup();
    const room = await service.create(admin, { name: 'Atlas', capacity: 6 });
    await expect(service.create(membre, { name: 'X', capacity: 2 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.update(membre, room.id, { name: 'X', capacity: 2 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.remove(membre, room.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('un membre peut lister les salles', async () => {
    const { service } = setup();
    await service.create(admin, { name: 'Atlas', capacity: 6 });
    expect(await service.list()).toHaveLength(1);
  });
});

describe('RoomService · validation et absence', () => {
  it.each([
    ['capacité 0', { name: 'X', capacity: 0 }],
    ['capacité décimale', { name: 'X', capacity: 2.5 }],
    ['nom vide', { name: ' ', capacity: 2 }],
  ])('refuse %s (400)', async (_label, input) => {
    const { service } = setup();
    await expect(service.create(admin, input)).rejects.toBeInstanceOf(ValidationError);
  });

  it('renvoie 404 pour une salle inconnue', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'nope', { name: 'X', capacity: 2 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.remove(admin, 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RoomService.findAvailable', () => {
  it('exclut les salles réservées et trop petites', async () => {
    const { service, bookings } = setup();
    const atlas = await service.create(admin, { name: 'Atlas', capacity: 6 });
    await service.create(admin, { name: 'Boite', capacity: 2 });
    const orion = await service.create(admin, { name: 'Orion', capacity: 10 });
    await bookings.save({ id: 'b1', roomId: atlas.id, ownerId: 'm1', subject: 'x', start: h(10), end: h(11) });

    const libres = await service.findAvailable({ start: h(10), end: h(11) }, 4);
    expect(libres.map((r) => r.id)).toEqual([orion.id]);
  });

  it('une réservation bout à bout ne bloque pas', async () => {
    const { service, bookings } = setup();
    const atlas = await service.create(admin, { name: 'Atlas', capacity: 6 });
    await bookings.save({ id: 'b1', roomId: atlas.id, ownerId: 'm1', subject: 'x', start: h(10), end: h(11) });
    expect(await service.findAvailable({ start: h(11), end: h(12) })).toHaveLength(1);
  });

  it('refuse un créneau dont la fin précède le début (400)', async () => {
    const { service } = setup();
    await expect(service.findAvailable({ start: h(11), end: h(10) })).rejects.toBeInstanceOf(ValidationError);
  });
});

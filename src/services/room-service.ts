import { randomUUID } from 'node:crypto';
import { findAvailableRooms } from '../domain/availability.js';
import type { Room, Slot, User } from '../domain/types.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/index.js';
import type { BookingRepository, RoomRepository } from '../repositories/interfaces.js';

export interface RoomInput {
  readonly name: string;
  readonly capacity: number;
  readonly equipment?: readonly string[];
}

function assertAdmin(actor: User): void {
  if (actor.role !== 'admin') throw new ForbiddenError('Réservé aux administrateurs');
}

function assertValid(input: RoomInput): void {
  if (input.name.trim() === '') throw new ValidationError('Le nom de la salle est requis');
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new ValidationError('La capacité doit être un entier d’au moins 1');
  }
}

function toRoom(id: string, input: RoomInput): Room {
  return {
    id,
    name: input.name,
    capacity: input.capacity,
    equipment: input.equipment ?? [],
  };
}

export class RoomService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly bookings: BookingRepository,
  ) {}

  list(): Promise<Room[]> {
    return this.rooms.findAll();
  }

  async create(actor: User, input: RoomInput): Promise<Room> {
    assertAdmin(actor);
    assertValid(input);
    const room = toRoom(randomUUID(), input);
    await this.rooms.save(room);
    return room;
  }

  async update(actor: User, id: string, input: RoomInput): Promise<Room> {
    assertAdmin(actor);
    assertValid(input);
    if (!(await this.rooms.findById(id))) throw new NotFoundError('Salle introuvable');
    const room = toRoom(id, input);
    await this.rooms.save(room);
    return room;
  }

  async remove(actor: User, id: string): Promise<void> {
    assertAdmin(actor);
    if (!(await this.rooms.delete(id))) throw new NotFoundError('Salle introuvable');
  }

  async findAvailable(slot: Slot, minCapacity = 1): Promise<Room[]> {
    if (slot.start >= slot.end) throw new ValidationError('Le début doit précéder la fin');
    const rooms = await this.rooms.findAll();
    const bookings = (
      await Promise.all(rooms.map((r) => this.bookings.findByRoom(r.id)))
    ).flat();
    return findAvailableRooms(rooms, bookings, slot, minCapacity);
  }
}

import { randomUUID } from 'node:crypto';
import { overlaps } from '../domain/overlap.js';
import type { Booking, Slot, User } from '../domain/types.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';
import type { BookingRepository, RoomRepository } from '../repositories/interfaces.js';
import { assertSlotOrder } from './slot-guard.js';

export class BookingService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly bookings: BookingRepository,
    /** Horloge injectée pour des tests déterministes. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async book(user: User, roomId: string, slot: Slot, subject: string): Promise<Booking> {
    assertSlotOrder(slot);
    if (slot.start < this.now()) throw new ValidationError('Le créneau est dans le passé');
    if (subject.trim() === '') throw new ValidationError('Le sujet est requis');
    if (!(await this.rooms.findById(roomId))) throw new NotFoundError('Salle introuvable');

    const existing = await this.bookings.findByRoom(roomId);
    if (existing.some((b) => overlaps(b, slot))) {
      throw new ConflictError('La salle est déjà réservée sur ce créneau');
    }

    const booking: Booking = {
      id: randomUUID(),
      roomId,
      ownerId: user.id,
      subject,
      start: slot.start,
      end: slot.end,
    };
    await this.bookings.save(booking);
    return booking;
  }

  /** Libère la salle : seul le propriétaire ou un admin peut annuler. */
  async cancel(user: User, bookingId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new NotFoundError('Réservation introuvable');
    if (booking.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('Vous ne pouvez annuler que vos réservations');
    }
    await this.bookings.delete(bookingId);
  }

  listMine(user: User): Promise<Booking[]> {
    return this.bookings.findByOwner(user.id);
  }
}

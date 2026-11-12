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
  /** Verrou par salle : la vérification de chevauchement et l'écriture forment une seule section. */
  private readonly roomLocks = new Map<string, Promise<unknown>>();

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

    return this.withRoomLock(roomId, async () => {
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
    });
  }

  /**
   * Exécute `task` après les précédentes opérations sur la même salle.
   * Limite : verrou en mémoire, valable pour un seul processus. Avec une base
   * partagée, il faut une transaction ou une contrainte d'unicité côté stockage.
   */
  private withRoomLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.roomLocks.get(roomId) ?? Promise.resolve();
    const current = previous.then(task);
    const tail = current.catch(() => undefined);
    this.roomLocks.set(roomId, tail);
    void tail.then(() => {
      if (this.roomLocks.get(roomId) === tail) this.roomLocks.delete(roomId);
    });
    return current;
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

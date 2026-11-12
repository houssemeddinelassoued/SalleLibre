import { randomUUID } from 'node:crypto';
import { MAX_OCCURRENCES, SEMAINE_MS, expandWeekly } from '../domain/recurrence.js';
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
   * Réservation hebdomadaire : une occurrence par semaine, du créneau `first`
   * jusqu'au jour `untilDay` inclus, en sautant les dates `exceptions`.
   * Tout ou rien : si une seule occurrence est en conflit, rien n'est écrit.
   */
  async bookWeekly(
    user: User,
    roomId: string,
    first: Slot,
    untilDay: string,
    exceptions: readonly string[],
    subject: string,
  ): Promise<Booking[]> {
    assertSlotOrder(first);
    if (first.end.getTime() - first.start.getTime() > SEMAINE_MS) {
      throw new ValidationError('La durée d’un créneau récurrent ne peut pas dépasser une semaine');
    }
    if (subject.trim() === '') throw new ValidationError('Le sujet est requis');
    if (!(await this.rooms.findById(roomId))) throw new NotFoundError('Salle introuvable');

    const occurrences = expandWeekly(first, untilDay, exceptions, MAX_OCCURRENCES + 1);
    if (occurrences.length === 0) throw new ValidationError('Aucune occurrence sur cette période');
    if (occurrences.length > MAX_OCCURRENCES) {
      throw new ValidationError(`Une série compte au plus ${MAX_OCCURRENCES} occurrences`);
    }
    const now = this.now();
    if (occurrences.some((s) => s.start < now)) {
      throw new ValidationError('Une occurrence est dans le passé');
    }

    return this.withRoomLock(roomId, async () => {
      const existing = await this.bookings.findByRoom(roomId);
      if (occurrences.some((s) => existing.some((b) => overlaps(b, s)))) {
        throw new ConflictError('Une occurrence chevauche une réservation existante');
      }

      const created: Booking[] = occurrences.map((s) => ({
        id: randomUUID(),
        roomId,
        ownerId: user.id,
        subject,
        start: s.start,
        end: s.end,
      }));
      for (const booking of created) await this.bookings.save(booking);
      return created;
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

import { overlaps } from './overlap.js';
import type { Booking, WaitlistEntry } from './types.js';

export interface Promotions {
  readonly promoted: WaitlistEntry[];
  readonly expired: WaitlistEntry[];
}

/**
 * Choisit les entrées d'attente d'une salle à promouvoir en réservation.
 *
 * Parcours FIFO (createdAt, puis ordre du tableau). Une entrée qui commence
 * avant `now` est expirée. Une entrée valide est promue si son créneau est
 * libre, réservations existantes et entrées déjà promues comprises (gloutonne).
 * Fonction pure : aucun argument n'est modifié.
 */
export function selectPromotions(
  entries: readonly WaitlistEntry[],
  bookings: readonly Booking[],
  now: Date,
): Promotions {
  const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const promoted: WaitlistEntry[] = [];
  const expired: WaitlistEntry[] = [];

  for (const entry of ordered) {
    if (entry.start < now) {
      expired.push(entry);
    } else if (!bookings.some((b) => overlaps(b, entry)) && !promoted.some((p) => overlaps(p, entry))) {
      promoted.push(entry);
    }
  }
  return { promoted, expired };
}

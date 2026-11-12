import type { Slot } from './types.js';

export const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Borne d'une série récurrente : au plus six mois de créneaux hebdomadaires. */
export const MAX_OCCURRENCES = 26;

/**
 * Occurrences hebdomadaires d'un créneau, jusqu'au jour limite inclus.
 *
 * - `untilDay` : date au format AAAA-MM-JJ, incluse (fin de journée UTC).
 * - `exceptions` : dates AAAA-MM-JJ à sauter.
 * - `limit` : nombre maximal d'occurrences renvoyées, pour borner le calcul.
 *
 * Fonction pure : aucun paramètre n'est modifié.
 */
export function expandWeekly(
  slot: Slot,
  untilDay: string,
  exceptions: readonly string[],
  limit: number,
): Slot[] {
  const fin = Date.parse(`${untilDay}T23:59:59.999Z`);
  const exclues = new Set(exceptions);
  const duree = slot.end.getTime() - slot.start.getTime();
  const occurrences: Slot[] = [];

  for (let debut = slot.start.getTime(); debut <= fin && occurrences.length < limit; debut += SEMAINE_MS) {
    const start = new Date(debut);
    if (exclues.has(start.toISOString().slice(0, 10))) continue;
    occurrences.push({ start, end: new Date(debut + duree) });
  }
  return occurrences;
}

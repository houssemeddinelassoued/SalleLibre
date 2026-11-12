import { describe, it, expect } from 'vitest';
import { expandWeekly } from '../../domain/recurrence.js';
import type { Slot } from '../../domain/types.js';

// Dates fixes en UTC : jamais l'heure réelle.
// 2026-11-10 est un mardi.
const mardi = (hh: number, mm = 0, jour = 10): Date => new Date(Date.UTC(2026, 10, jour, hh, mm));
const slot = (start: Date, end: Date): Slot => ({ start, end });

describe('expandWeekly', () => {
  it('répète chaque semaine, du premier créneau jusqu’au jour limite inclus', () => {
    // Mardi 10, 17 et 24 novembre : la limite du 24 est incluse.
    const occurrences = expandWeekly(slot(mardi(10), mardi(11)), '2026-11-24', [], 26);

    expect(occurrences.map((s) => s.start.toISOString())).toEqual([
      '2026-11-10T10:00:00.000Z',
      '2026-11-17T10:00:00.000Z',
      '2026-11-24T10:00:00.000Z',
    ]);
  });

  it('garde la durée du créneau d’origine', () => {
    const [premier] = expandWeekly(slot(mardi(10), mardi(11, 30)), '2026-11-17', [], 26);

    expect(premier.end.getTime() - premier.start.getTime()).toBe(90 * 60 * 1000);
  });

  it('retire les dates d’exception, sans toucher aux autres', () => {
    const occurrences = expandWeekly(slot(mardi(10), mardi(11)), '2026-11-24', ['2026-11-17'], 26);

    expect(occurrences.map((s) => s.start.toISOString())).toEqual([
      '2026-11-10T10:00:00.000Z',
      '2026-11-24T10:00:00.000Z',
    ]);
  });

  it('ignore une exception qui ne tombe sur aucune occurrence', () => {
    const occurrences = expandWeekly(slot(mardi(10), mardi(11)), '2026-11-17', ['2026-11-11'], 26);

    expect(occurrences).toHaveLength(2);
  });

  it('renvoie une seule occurrence si la limite est le jour du premier créneau', () => {
    const occurrences = expandWeekly(slot(mardi(10), mardi(11)), '2026-11-10', [], 26);

    expect(occurrences).toHaveLength(1);
  });

  it('renvoie une liste vide si la limite est avant le premier créneau', () => {
    expect(expandWeekly(slot(mardi(10), mardi(11)), '2026-11-09', [], 26)).toEqual([]);
  });

  it('ne dépasse jamais la limite de nombre d’occurrences demandée', () => {
    // Un an de mardis : sans borne, on obtiendrait plus de 50 créneaux.
    const occurrences = expandWeekly(slot(mardi(10), mardi(11)), '2027-11-10', [], 27);

    expect(occurrences).toHaveLength(27);
  });

  it('ne modifie pas le créneau d’origine ni les exceptions', () => {
    const origine = Object.freeze(slot(mardi(10), mardi(11)));
    const exceptions = Object.freeze(['2026-11-17']);

    expect(() => expandWeekly(origine, '2026-11-24', exceptions, 26)).not.toThrow();
    expect(origine.start.getTime()).toBe(mardi(10).getTime());
    expect(exceptions).toEqual(['2026-11-17']);
  });
});

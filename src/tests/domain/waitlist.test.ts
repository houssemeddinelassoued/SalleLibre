import { describe, it, expect } from 'vitest';
import { selectPromotions } from '../../domain/waitlist.js';
import type { Booking, WaitlistEntry } from '../../domain/types.js';

// Date fixe : jamais l'heure réelle.
const h = (hh: number, mm = 0): Date => new Date(Date.UTC(2026, 10, 12, hh, mm));
const NOW = h(9);

const entry = (id: string, start: Date, end: Date, createdAt: Date): WaitlistEntry => ({
  id,
  roomId: 'salle-1',
  ownerId: `user-${id}`,
  subject: `Sujet ${id}`,
  start,
  end,
  createdAt,
});
const booking = (id: string, start: Date, end: Date): Booking => ({
  id,
  roomId: 'salle-1',
  ownerId: 'autre',
  subject: 'Réunion',
  start,
  end,
});
const ids = (list: readonly { id: string }[]): string[] => list.map((x) => x.id);

describe('selectPromotions', () => {
  it.each([
    [
      'promeut l’entrée dont le créneau est libre',
      [entry('a', h(10), h(11), h(1))],
      [],
      ['a'],
    ],
    [
      'ne promeut pas une entrée dont le créneau est entièrement occupé',
      [entry('a', h(10), h(11), h(1))],
      [booking('b1', h(10), h(11))],
      [],
    ],
    [
      'ne promeut pas une entrée en chevauchement partiel',
      [entry('a', h(10), h(12), h(1))],
      [booking('b1', h(11), h(13))],
      [],
    ],
    [
      'promeut l’entrée libre et laisse l’entrée occupée (partiellement libre)',
      [entry('a', h(10), h(11), h(1)), entry('b', h(14), h(15), h(2))],
      [booking('b1', h(10, 30), h(11, 30))],
      ['b'],
    ],
    [
      'borne exclue : entrée 10h–11h, réservation 11h–12h → promue',
      [entry('a', h(10), h(11), h(1))],
      [booking('b1', h(11), h(12))],
      ['a'],
    ],
    [
      'borne exclue : entrée 11h–12h, réservation 10h–11h → promue',
      [entry('a', h(11), h(12), h(1))],
      [booking('b1', h(10), h(11))],
      ['a'],
    ],
    [
      'une minute de recouvrement avec une réservation → non promue',
      [entry('a', h(10), h(11), h(1))],
      [booking('b1', h(10, 59), h(12))],
      [],
    ],
  ])('%s', (_nom, entries, bookings, promusAttendus) => {
    const { promoted, expired } = selectPromotions(entries, bookings, NOW);

    expect(ids(promoted)).toEqual(promusAttendus);
    expect(expired).toEqual([]);
  });

  it.each([
    [
      'FIFO : la plus ancienne inscription est promue d’abord (tableau désordonné)',
      [entry('recent', h(10), h(11), h(3)), entry('ancien', h(12), h(13), h(1)), entry('milieu', h(14), h(15), h(2))],
      ['ancien', 'milieu', 'recent'],
    ],
    [
      'FIFO : égalité de createdAt → ordre du tableau (départage stable)',
      [entry('x', h(10), h(11), h(1)), entry('y', h(12), h(13), h(1)), entry('z', h(14), h(15), h(1))],
      ['x', 'y', 'z'],
    ],
  ])('%s', (_nom, entries, promusAttendus) => {
    const { promoted } = selectPromotions(entries, [], NOW);

    expect(ids(promoted)).toEqual(promusAttendus);
  });

  it.each([
    [
      'deux entrées qui se chevauchent : seule la première inscrite est promue',
      [entry('premiere', h(10), h(11), h(1)), entry('seconde', h(10, 30), h(11, 30), h(2))],
      ['premiere'],
    ],
    [
      'deux entrées qui se chevauchent, tableau inversé : la première inscrite l’emporte',
      [entry('seconde', h(10, 30), h(11, 30), h(2)), entry('premiere', h(10), h(11), h(1))],
      ['premiere'],
    ],
    [
      'deux entrées identiques : seule la première inscrite est promue',
      [entry('premiere', h(10), h(11), h(1)), entry('seconde', h(10), h(11), h(2))],
      ['premiere'],
    ],
    [
      'deux entrées disjointes : les deux sont promues',
      [entry('a', h(10), h(11), h(1)), entry('b', h(14), h(15), h(2))],
      ['a', 'b'],
    ],
    [
      'deux entrées bout à bout : les deux sont promues',
      [entry('a', h(10), h(11), h(1)), entry('b', h(11), h(12), h(2))],
      ['a', 'b'],
    ],
    [
      'gloutonne : la 3ᵉ, disjointe de la 1ʳᵉ, est promue malgré le rejet de la 2ᵉ',
      [
        entry('a', h(10), h(11), h(1)),
        entry('b', h(10, 30), h(12), h(2)),
        entry('c', h(11), h(12), h(3)),
      ],
      ['a', 'c'],
    ],
  ])('%s', (_nom, entries, promusAttendus) => {
    const { promoted, expired } = selectPromotions(entries, [], NOW);

    expect(ids(promoted)).toEqual(promusAttendus);
    expect(expired).toEqual([]);
  });

  it('une entrée non promue (créneau occupé) n’est pas expirée', () => {
    const entries = [entry('a', h(10), h(11), h(1))];
    const bookings = [booking('b1', h(10), h(11))];

    const result = selectPromotions(entries, bookings, NOW);

    expect(result.promoted).toEqual([]);
    expect(result.expired).toEqual([]);
  });

  it.each([
    ['start < now : expirée, non promue', h(8, 59), [], ['a']],
    ['start très antérieur à now : expirée, non promue', h(1), [], ['a']],
    ['start == now : reste valide et est promue', h(9), ['a'], []],
    ['start == now + 1 minute : valide et promue', h(9, 1), ['a'], []],
  ])('%s', (_nom, start, promusAttendus, expiresAttendus) => {
    const entries = [entry('a', start, h(12), h(1))];

    const { promoted, expired } = selectPromotions(entries, [], NOW);

    expect(ids(promoted)).toEqual(promusAttendus);
    expect(ids(expired)).toEqual(expiresAttendus);
  });

  it('une entrée expirée ne bloque pas les suivantes et ne compte pas comme promue', () => {
    const entries = [
      entry('passee', h(8), h(10), h(1)),
      entry('valide', h(9), h(10), h(2)),
    ];

    const { promoted, expired } = selectPromotions(entries, [], NOW);

    expect(ids(expired)).toEqual(['passee']);
    expect(ids(promoted)).toEqual(['valide']);
  });

  it('une entrée expirée est purgée même si son créneau est occupé', () => {
    const entries = [entry('passee', h(8), h(10), h(1))];
    const bookings = [booking('b1', h(8), h(10))];

    const { promoted, expired } = selectPromotions(entries, bookings, NOW);

    expect(ids(expired)).toEqual(['passee']);
    expect(promoted).toEqual([]);
  });

  it.each([
    ['aucune entrée, aucune réservation', [], []],
    ['aucune entrée, des réservations', [], [booking('b1', h(10), h(11))]],
  ])('listes vides : %s → résultats vides', (_nom, entries, bookings) => {
    const result = selectPromotions(entries, bookings, NOW);

    expect(result).toEqual({ promoted: [], expired: [] });
  });

  it('ne modifie aucun de ses arguments', () => {
    const entries = Object.freeze([
      Object.freeze(entry('recent', h(10), h(11), h(3))),
      Object.freeze(entry('ancien', h(12), h(13), h(1))),
      Object.freeze(entry('passee', h(8), h(9), h(2))),
    ]);
    const bookings = Object.freeze([Object.freeze(booking('b1', h(15), h(16)))]);
    const now = new Date(NOW.getTime());
    const entriesAvant = entries.map((e) => ({ ...e }));
    const bookingsAvant = bookings.map((b) => ({ ...b }));

    expect(() => selectPromotions(entries, bookings, now)).not.toThrow();

    expect(entries).toEqual(entriesAvant);
    expect(ids(entries)).toEqual(['recent', 'ancien', 'passee']);
    expect(bookings).toEqual(bookingsAvant);
    expect(now.getTime()).toBe(NOW.getTime());
  });
});

import { describe, it, expect } from 'vitest';
import type { WaitlistEntry } from '../../domain/types.js';
import type { WaitlistRepository } from '../../repositories/interfaces.js';
import { InMemoryWaitlistRepository } from '../../repositories/in-memory.js';

const entry = (id: string, roomId: string, ownerId: string): WaitlistEntry => ({
  id,
  roomId,
  ownerId,
  subject: 'Réunion',
  start: new Date(Date.UTC(2026, 10, 12, 10)),
  end: new Date(Date.UTC(2026, 10, 12, 11)),
  createdAt: new Date(Date.UTC(2026, 10, 12, 8)),
});

/** Trois entrées : deux salles, deux propriétaires, insérées dans l'ordre 1, 2, 3, 4. */
const seed = async (repo: WaitlistRepository): Promise<void> => {
  await repo.save(entry('1', 'a', 'u1'));
  await repo.save(entry('2', 'a', 'u2'));
  await repo.save(entry('3', 'b', 'u1'));
  await repo.save(entry('4', 'a', 'u1'));
};

describe('InMemoryWaitlistRepository', () => {
  it.each([
    { roomId: 'a', attendu: ['1', '2', '4'] },
    { roomId: 'b', attendu: ['3'] },
    { roomId: 'inconnue', attendu: [] },
  ])(
    'findByRoom ne renvoie que les entrées de la salle $roomId, dans l\'ordre d\'insertion',
    async ({ roomId, attendu }) => {
      const repo = new InMemoryWaitlistRepository();
      await seed(repo);

      const result = await repo.findByRoom(roomId);

      expect(result.map((e) => e.id)).toEqual(attendu);
    },
  );

  it.each([
    { ownerId: 'u1', attendu: ['1', '3', '4'] },
    { ownerId: 'u2', attendu: ['2'] },
    { ownerId: 'inconnu', attendu: [] },
  ])(
    'findByOwner ne renvoie que les entrées de $ownerId, dans l\'ordre d\'insertion',
    async ({ ownerId, attendu }) => {
      const repo = new InMemoryWaitlistRepository();
      await seed(repo);

      const result = await repo.findByOwner(ownerId);

      expect(result.map((e) => e.id)).toEqual(attendu);
    },
  );

  it('findByRoom renvoie une liste vide sur un dépôt vide', async () => {
    const repo = new InMemoryWaitlistRepository();

    const result = await repo.findByRoom('a');

    expect(result).toEqual([]);
  });

  it('findById retrouve l\'entrée enregistrée, createdAt compris', async () => {
    const repo = new InMemoryWaitlistRepository();
    await seed(repo);

    const result = await repo.findById('2');

    expect(result).toEqual(entry('2', 'a', 'u2'));
    expect(result?.createdAt).toEqual(new Date(Date.UTC(2026, 10, 12, 8)));
  });

  it.each([{ id: 'inconnu' }, { id: '' }, { id: '5' }])(
    'findById renvoie undefined pour l\'id « $id » inconnu',
    async ({ id }) => {
      const repo = new InMemoryWaitlistRepository();
      await seed(repo);

      const result = await repo.findById(id);

      expect(result).toBeUndefined();
    },
  );

  it('save écrase l\'entrée de même id sans la dupliquer', async () => {
    const repo = new InMemoryWaitlistRepository();
    await repo.save(entry('1', 'a', 'u1'));

    await repo.save({ ...entry('1', 'a', 'u1'), subject: 'Revue' });

    expect(await repo.findByRoom('a')).toHaveLength(1);
    expect((await repo.findById('1'))?.subject).toBe('Revue');
  });

  it('save d\'un id existant avec une autre salle retire l\'entrée de l\'ancienne salle', async () => {
    const repo = new InMemoryWaitlistRepository();
    await repo.save(entry('1', 'a', 'u1'));

    await repo.save(entry('1', 'b', 'u1'));

    expect(await repo.findByRoom('a')).toEqual([]);
    expect((await repo.findByRoom('b')).map((e) => e.id)).toEqual(['1']);
  });

  it('delete renvoie true puis false pour la même entrée', async () => {
    const repo = new InMemoryWaitlistRepository();
    await repo.save(entry('1', 'a', 'u1'));

    const first = await repo.delete('1');
    const second = await repo.delete('1');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await repo.findById('1')).toBeUndefined();
  });

  it('delete renvoie false pour un id inconnu et ne touche à rien', async () => {
    const repo = new InMemoryWaitlistRepository();
    await seed(repo);

    const result = await repo.delete('inconnu');

    expect(result).toBe(false);
    expect(await repo.findByRoom('a')).toHaveLength(3);
  });

  it('delete ne retire que l\'entrée visée', async () => {
    const repo = new InMemoryWaitlistRepository();
    await seed(repo);

    await repo.delete('2');

    expect((await repo.findByRoom('a')).map((e) => e.id)).toEqual(['1', '4']);
    expect((await repo.findByOwner('u1')).map((e) => e.id)).toEqual(['1', '3', '4']);
  });

  it('deux dépôts sont indépendants', async () => {
    const first = new InMemoryWaitlistRepository();
    const second = new InMemoryWaitlistRepository();

    await first.save(entry('1', 'a', 'u1'));

    expect(await second.findById('1')).toBeUndefined();
  });
});

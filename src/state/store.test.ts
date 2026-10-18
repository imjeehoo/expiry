import { describe, expect, it } from 'vitest';
import type { Entry, PersistedState } from '../types';
import { reducer } from './store';

const entry = (id: string, name: string, d: number, amount = 1): Entry =>
  ({ id, name, weight: '500', unit: 'g', y: 2026, m: 12, d, amount });
const base = (entries: Entry[]): PersistedState => ({ entries, names: {}, unit: 'g' });

describe('reducer', () => {
  it('add remembers the name for next time', () => {
    const s = reducer(base([]), { type: 'add', entry: entry('1', '우유', 1) });
    expect(s.entries).toHaveLength(1);
    expect(s.names['우유']).toEqual({ weight: '500', unit: 'g' });
  });

  it('remove then restore puts the entry back where it was', () => {
    const start = base([entry('1', 'a', 1), entry('2', 'b', 2), entry('3', 'c', 3)]);
    const removed = reducer(start, { type: 'remove', id: '2' });
    const back = reducer(removed, { type: 'restore', entry: start.entries[1], index: 1 });
    expect(back.entries.map((e) => e.id)).toEqual(['1', '2', '3']);
  });

  it('edit renames the whole item but changes the count of one lot only', () => {
    const start = base([entry('1', '우유', 1, 2), entry('2', '우유', 2, 5), entry('3', '쌀', 3, 1)]);
    const s = reducer(start, { type: 'edit', id: '1', name: '두유', weight: '1000', unit: 'ml', amount: 9 });
    expect(s.entries.map((e) => [e.name, e.weight, e.unit, e.amount])).toEqual([
      ['두유', '1000', 'ml', 9],
      ['두유', '1000', 'ml', 5],
      ['쌀', '500', 'g', 1],
    ]);
    expect(s.names['두유']).toEqual({ weight: '1000', unit: 'ml' });
  });

  it('import can be undone, restoring remembered names', () => {
    const start = base([entry('1', 'a', 1)]);
    const imported = reducer(start, { type: 'import', entries: [entry('2', 'b', 2)] });
    expect(imported.names.b).toBeDefined();
    const undone = reducer(imported, { type: 'undoImport', ids: ['2'], names: start.names });
    expect(undone.entries.map((e) => e.id)).toEqual(['1']);
    expect(undone.names.b).toBeUndefined();
  });
});

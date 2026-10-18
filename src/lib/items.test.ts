import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { groupEntries } from './items';

const e = (id: string, name: string, y: number, m: number, d: number, amount = 1): Entry =>
  ({ id, name, weight: '500', unit: 'g', y, m, d, amount });

describe('groupEntries', () => {
  it('keeps items in first-entered order and sorts dates within each item', () => {
    const groups = groupEntries([
      e('1', '우유', 2027, 5, 1),
      e('2', '쌀', 2026, 1, 1),
      e('3', '우유', 2026, 12, 25, 3),
      e('4', '우유', 2027, 1, 1),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['우유', '쌀']);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['3', '4', '1']);
    expect(groups[0].total).toBe(5);
  });
  it('treats a different weight as a different item', () => {
    const a = e('1', '우유', 2026, 1, 1);
    const b = { ...e('2', '우유', 2026, 1, 2), weight: '1000' };
    expect(groupEntries([a, b])).toHaveLength(2);
  });
});

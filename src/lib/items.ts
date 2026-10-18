import type { Entry, Group } from '../types';
import { iso } from './dates';

export const groupKey = (e: Pick<Entry, 'name' | 'weight' | 'unit'>) => `${e.name}\u0000${e.weight}\u0000${e.unit}`;
export const dateKey = (e: Entry) => iso(e.y, e.m, e.d);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * Items stay in the order they were first entered; each item's dates run earliest first.
 * The list view and the Excel export both use this one ordering.
 */
export function groupEntries(entries: Entry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const e of entries) {
    const key = groupKey(e);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, name: e.name, weight: e.weight, unit: e.unit, rows: [], total: 0 }));
    g.rows.push(e);
    g.total += e.amount;
  }
  for (const g of groups.values()) g.rows.sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  return [...groups.values()];
}

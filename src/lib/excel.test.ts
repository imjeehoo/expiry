import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { buildXlsx, parseXlsx } from './excel';
import { toSheetRows } from './exporter';
import { dedupe, rowsToEntries } from './importer';

const read = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });

const entry = (id: string, name: string, weight: string, unit: Entry['unit'], y: number, m: number, d: number, amount: number): Entry =>
  ({ id, name, weight, unit, y, m, d, amount });

describe('xlsx writer + reader', () => {
  it('round-trips text, numbers and real dates', async () => {
    const rows = [['이름', '날짜', '수'], ['우유 & <두유>', { date: [2026, 12, 25] as [number, number, number] }, 3]];
    const parsed = await parseXlsx(await read(buildXlsx(rows, { sheetName: '시트' })));
    expect(parsed).toEqual(rows);
  });
});

describe('export', () => {
  const entries = [
    entry('1', '우유', '1.5', 'L', 2027, 5, 1, 2),
    entry('2', '쌀', '', 'g', 2026, 1, 1, 1),
    entry('3', '우유', '1.5', 'L', 2026, 12, 25, 3),
  ];
  it('keeps item order, sorts dates within an item, and converts kg / L to g / ml', () => {
    const rows = toSheetRows(entries);
    expect(rows[0]).toEqual(['이름', '무게', '단위', '유통기한', '수량']);
    expect(rows.slice(1).map((r) => [r[0], r[1], r[2], r[4]])).toEqual([
      ['우유', 1500, 'ml', 3],
      ['우유', 1500, 'ml', 2],
      ['쌀', '', '', 1],
    ]);
  });
});

describe('import', () => {
  it('reads Korean headers and splits "500g" style weights', () => {
    const res = rowsToEntries([
      ['이름', '무게', '유통기한', '수량'],
      ['우유', '500g', { date: [2026, 12, 25] }, 3],
      [null, null, null, null],
      ['', '1kg', { date: [2026, 1, 1] }, 1],
      ['쌀', '2kg', '2026-13-45', 1],
    ])!;
    expect(res.skipped).toBe(2);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0]).toMatchObject({ name: '우유', weight: '500', unit: 'g', y: 2026, m: 12, d: 25, amount: 3 });
  });
  it('returns null when there are no Name / Expiry columns', () => {
    expect(rowsToEntries([['a', 'b'], [1, 2]])).toBeNull();
  });
  it('re-importing an export adds nothing', async () => {
    const entries = [entry('1', '우유', '500', 'g', 2026, 12, 25, 3), entry('2', '쌀', '1500', 'g', 2027, 1, 1, 1)];
    const sheet = await parseXlsx(await read(buildXlsx(toSheetRows(entries))));
    const parsed = rowsToEntries(sheet)!;
    expect(dedupe(parsed, entries)).toMatchObject({ fresh: [], duplicates: 2 });
    expect(dedupe(parsed, [])).toMatchObject({ duplicates: 0 });
  });
});

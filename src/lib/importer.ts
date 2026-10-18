import { UNITS, type Entry, type Unit } from '../types';
import type { Cell } from './excel';
import { parseXlsx } from './excel';
import { realDate } from './dates';
import { dateKey, groupKey, newId } from './items';
import { asUnit, parseWeight } from './weight';

type Column = 'name' | 'weight' | 'unit' | 'expiry' | 'amount';

// English and Korean header names, matched loosely.
const HEADERS: Record<Column, RegExp> = {
  name: /name|이름|품명|상품|제품/i,
  weight: /weight|무게|중량|용량|규격/i,
  unit: /^\s*unit|단위/i,
  expiry: /expir|유통|소비|기한|date|날짜/i,
  amount: /amount|qty|quantity|count|개수|갯수|수량/i,
};

const isText = (c: Cell): c is string => typeof c === 'string';

function parseDateCell(v: Cell): [number, number, number] | null {
  if (v && typeof v === 'object') return v.date;
  const m = typeof v === 'string' && v.trim().match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export interface ParsedRows {
  entries: Entry[];
  skipped: number;
}

/** Turns sheet rows (header row + data rows) into entries. Blank rows are ignored; unusable rows are counted. */
export function rowsToEntries(rows: Cell[][]): ParsedRows | null {
  const headerIndex = rows.findIndex(
    (r) => r.some((c) => isText(c) && HEADERS.name.test(c)) && r.some((c) => isText(c) && HEADERS.expiry.test(c)),
  );
  if (headerIndex < 0) return null;

  const col: Partial<Record<Column, number>> = {};
  rows[headerIndex].forEach((c, i) => {
    if (!isText(c)) return;
    for (const k of Object.keys(HEADERS) as Column[]) {
      if (!(k in col) && HEADERS[k].test(c)) { col[k] = i; break; }
    }
  });
  const cell = (r: Cell[], k: Column) => (col[k] === undefined ? null : r[col[k]]);

  const entries: Entry[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIndex + 1)) {
    if (!r.some((c) => c !== null && c !== '')) continue; // separator row
    const name = String(cell(r, 'name') ?? '').trim();
    const date = parseDateCell(cell(r, 'expiry') ?? null);
    if (!name || !date || !realDate(...date)) { skipped++; continue; }
    const parsed = parseWeight(cell(r, 'weight'), 'g');
    const unit: Unit = asUnit(String(cell(r, 'unit') ?? '')) ?? parsed.unit;
    entries.push({
      id: newId() + entries.length,
      name, weight: parsed.weight, unit: UNITS.includes(unit) ? unit : 'g',
      y: date[0], m: date[1], d: date[2],
      amount: Math.max(1, Math.round(Number(cell(r, 'amount'))) || 1),
    });
  }
  return { entries, skipped };
}

export interface ImportResult {
  fresh: Entry[];
  duplicates: number;
  skipped: number;
}

const lotKey = (e: Entry) => `${groupKey(e)}\u0000${dateKey(e)}\u0000${e.amount}`;

/** Drops rows that already exist (same item + date + amount) so re-importing an export adds nothing. */
export function dedupe(parsed: ParsedRows, existing: Entry[]): ImportResult {
  const seen = new Set(existing.map(lotKey));
  const fresh = parsed.entries.filter((e) => {
    const k = lotKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { fresh, duplicates: parsed.entries.length - fresh.length, skipped: parsed.skipped };
}

/** Throws if the file can't be read; resolves null if it has no Name / Expiry columns. */
export async function readImportFile(file: File, existing: Entry[]): Promise<ImportResult | null> {
  const parsed = rowsToEntries(await parseXlsx(await file.arrayBuffer()));
  return parsed && dedupe(parsed, existing);
}

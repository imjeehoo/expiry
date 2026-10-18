import type { Entry } from '../types';
import { buildXlsx, XLSX_MIME, type Cell } from './excel';
import { groupEntries } from './items';
import { pad } from './dates';
import { excelWeight } from './weight';

export const EXPORT_HEADERS = ['이름', '무게', '단위', '유통기한', '수량'] as const;

/** Rows exactly as they land in the sheet: item order as entered, dates earliest first, only g / ml. */
export function toSheetRows(entries: Entry[]): Cell[][] {
  const rows: Cell[][] = [[...EXPORT_HEADERS]];
  for (const g of groupEntries(entries)) {
    for (const e of g.rows) {
      const w = excelWeight(e.weight, e.unit);
      rows.push([e.name, w.value, w.unit, { date: [e.y, e.m, e.d] }, e.amount]);
    }
  }
  return rows;
}

const stamp = (t = new Date()) =>
  `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;

export function buildExport(entries: Entry[]): { blob: Blob; filename: string } {
  const blob = buildXlsx(toSheetRows(entries), { sheetName: '유통기한', widths: [32, 10, 7, 13, 9] });
  return { blob, filename: `expiry-${stamp()}.xlsx` };
}

/** Phones get the share sheet (save to Files, send…); everything else downloads. Returns true if saved. */
export async function saveOrShare(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: XLSX_MIME });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false;
      // otherwise fall through to a normal download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

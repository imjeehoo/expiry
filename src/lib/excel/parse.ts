import { unzip } from './zip';
import type { Cell } from './build';

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const isDateFormat = (code: string) => /[ymd]/i.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, ''));

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d/g, '')) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function fromSerial(n: number): Cell {
  const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
  return { date: [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()] };
}

/** Reads the first sheet into rows of text / numbers / {date}. Missing cells are null. */
export async function parseXlsx(buf: ArrayBuffer): Promise<Cell[][]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const xml = (name: string): Document | null =>
    files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null;
  const text = (n: Element) => [...n.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('');

  const wb = xml('xl/workbook.xml');
  if (!wb) throw new Error('Not an xlsx file');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const first = wb.getElementsByTagName('sheet')[0];
  const rid = first && (first.getAttribute('r:id') || first.getAttributeNS(REL_NS, 'id'));
  let target = 'worksheets/sheet1.xml';
  for (const r of rels ? [...rels.getElementsByTagName('Relationship')] : []) {
    if (r.getAttribute('Id') === rid) target = r.getAttribute('Target') ?? target;
  }
  const sheet = xml(target.startsWith('/') ? target.slice(1) : 'xl/' + target);
  if (!sheet) throw new Error('Sheet not found');

  const sst = xml('xl/sharedStrings.xml');
  const shared = sst ? [...sst.getElementsByTagName('si')].map(text) : [];

  // Which cell styles are dates (so numbers in those cells become real dates)
  const customFormats: Record<string, string> = {};
  const styles = xml('xl/styles.xml');
  const styleIsDate: boolean[] = [];
  if (styles) {
    for (const f of styles.getElementsByTagName('numFmt')) {
      customFormats[f.getAttribute('numFmtId') ?? ''] = f.getAttribute('formatCode') ?? '';
    }
    const xfs = styles.getElementsByTagName('cellXfs')[0];
    for (const xf of xfs ? [...xfs.getElementsByTagName('xf')] : []) {
      const id = Number(xf.getAttribute('numFmtId'));
      const custom = customFormats[String(id)];
      styleIsDate.push(BUILTIN_DATE_FORMATS.has(id) || (custom !== undefined && isDateFormat(custom)));
    }
  }

  const rows: Cell[][] = [];
  for (const row of sheet.getElementsByTagName('row')) {
    const r0 = Number(row.getAttribute('r')) - 1;
    const cells: Cell[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r');
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null;
      let val: Cell = null;
      if (type === 'inlineStr') val = text(c);
      else if (v === null) val = null;
      else if (type === 's') val = shared[Number(v)] ?? '';
      else if (type === 'str' || type === 'e') val = v;
      else if (type === 'b') val = v === '1' ? 1 : 0;
      else {
        const n = parseFloat(v);
        val = styleIsDate[Number(c.getAttribute('s')) || 0] ? fromSerial(n) : n;
      }
      cells[ref ? colIndex(ref) : cells.length] = val;
    }
    rows[Number.isNaN(r0) ? rows.length : r0] = Array.from(cells, (x) => (x === undefined ? null : x));
  }
  return Array.from(rows, (r) => r || []);
}

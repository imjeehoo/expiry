import { UNITS, type Unit } from '../types';

const NUMERIC = /^\d+([.,]\d+)?$/;
export const isNumericWeight = (w: string) => NUMERIC.test(w);
const toNumber = (w: string) => parseFloat(w.replace(',', '.'));

/** Display form: 1000g+ shows as kg and 1000ml+ as L; units are attached to the value ("500g"). */
export function formatWeight(weight: string, unit: Unit): string {
  if (!weight) return '';
  if (isNumericWeight(weight)) {
    const n = toNumber(weight);
    if (n >= 1000 && unit === 'g') return `${+(n / 1000).toFixed(2)}kg`;
    if (n >= 1000 && unit === 'ml') return `${+(n / 1000).toFixed(2)}L`;
  }
  return weight + unit;
}

/** Excel form: only g and ml; kg and L are multiplied out. Non-numeric weights stay text. */
export function excelWeight(weight: string, unit: Unit): { value: number | string; unit: string } {
  if (!weight) return { value: '', unit: '' };
  if (!isNumericWeight(weight)) return { value: weight, unit };
  const n = toNumber(weight);
  if (unit === 'kg') return { value: Math.round(n * 1000 * 100) / 100, unit: 'g' };
  if (unit === 'L') return { value: Math.round(n * 1000 * 100) / 100, unit: 'ml' };
  return { value: n, unit };
}

/** Splits "500g" / "1.5 kg" / "250" into value and unit; unknown text is kept as the weight. */
export function parseWeight(v: unknown, fallbackUnit: Unit): { weight: string; unit: Unit } {
  if (v === null || v === undefined || v === '') return { weight: '', unit: fallbackUnit };
  if (typeof v === 'number') return { weight: String(v), unit: fallbackUnit };
  const text = String(v).trim();
  const m = text.match(/^([\d.,]+)\s*(kg|g|ml|l)?$/i);
  if (!m) return { weight: text, unit: fallbackUnit };
  const raw = m[2]?.toLowerCase();
  const unit = raw ? (raw === 'l' ? 'L' : (raw as Unit)) : fallbackUnit;
  return { weight: m[1].replace(',', '.'), unit };
}

export const asUnit = (v: string): Unit | undefined => UNITS.find((u) => u.toLowerCase() === v.trim().toLowerCase());

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function realDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= (m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m]);
}

export interface ParsedDigits {
  complete: boolean;
  y: number;
  m: number;
  d: number;
  /** "YY", "YY.MM" or "YY.MM.DD" depending on how many digits are typed. */
  display: string;
}

/** YYMMDD typed as plain digits -> 20YY-MM-DD. */
export function parseDigits(digits: string): ParsedDigits {
  const s = digits.replace(/\D/g, '').slice(0, 6);
  return {
    complete: s.length === 6,
    y: 2000 + Number(s.slice(0, 2)),
    m: Number(s.slice(2, 4)),
    d: Number(s.slice(4, 6)),
    display: [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6)].filter(Boolean).join('.'),
  };
}

export type TypedDate =
  | { complete: false }
  | { complete: true; valid: boolean; y: number; m: number; d: number };

export function typedDate(digits: string): TypedDate {
  const p = parseDigits(digits);
  if (!p.complete) return { complete: false };
  return { complete: true, valid: realDate(p.y, p.m, p.d), y: p.y, m: p.m, d: p.d };
}

const DAY_MS = 86_400_000;

/** "오늘", "N일 지남", "N일 후", "N개월 후", "N년 후". */
export function relative(y: number, m: number, d: number, now = new Date()): string {
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS);
  if (days === 0) return '오늘';
  if (days < 0) return `${-days}일 지남`;
  if (days < 60) return `${days}일 후`;
  const months = (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1)) - (d < now.getDate() ? 1 : 0);
  if (months < 24) return `${months}개월 후`;
  return `${Math.floor(months / 12)}년 후`;
}

const longFormat = new Intl.DateTimeFormat('ko-KR', {
  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});

export const formatLong = (y: number, m: number, d: number) => longFormat.format(new Date(Date.UTC(y, m - 1, d)));

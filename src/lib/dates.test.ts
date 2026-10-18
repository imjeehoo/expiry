import { describe, expect, it } from 'vitest';
import { parseDigits, realDate, relative, typedDate } from './dates';

describe('parseDigits', () => {
  it('formats progressively as YY.MM.DD', () => {
    expect(parseDigits('2').display).toBe('2');
    expect(parseDigits('261').display).toBe('26.1');
    expect(parseDigits('261225').display).toBe('26.12.25');
  });
  it('is complete at six digits and maps to 20YY', () => {
    expect(parseDigits('26122').complete).toBe(false);
    expect(parseDigits('261225')).toMatchObject({ complete: true, y: 2026, m: 12, d: 25 });
  });
  it('ignores non-digits and extra digits', () => {
    expect(parseDigits('26.12.25 99').display).toBe('26.12.25');
  });
});

describe('realDate', () => {
  it('knows month lengths and leap years', () => {
    expect(realDate(2027, 2, 29)).toBe(false);
    expect(realDate(2028, 2, 29)).toBe(true);
    expect(realDate(2026, 4, 31)).toBe(false);
    expect(realDate(2026, 13, 1)).toBe(false);
    expect(realDate(2026, 12, 0)).toBe(false);
  });
});

describe('typedDate', () => {
  it('flags impossible dates', () => {
    expect(typedDate('261340')).toMatchObject({ complete: true, valid: false });
    expect(typedDate('260229')).toMatchObject({ complete: true, valid: false });
    expect(typedDate('261225')).toMatchObject({ complete: true, valid: true });
    expect(typedDate('2612')).toEqual({ complete: false });
  });
});

describe('relative', () => {
  const now = new Date(2026, 9, 18); // 2026-10-18
  it('describes distance in Korean', () => {
    expect(relative(2026, 10, 18, now)).toBe('오늘');
    expect(relative(2026, 10, 15, now)).toBe('3일 지남');
    expect(relative(2026, 10, 19, now)).toBe('1일 후');
    expect(relative(2027, 3, 1, now)).toBe('4개월 후');
    expect(relative(2030, 1, 1, now)).toBe('3년 후');
  });
});

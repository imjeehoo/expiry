import { describe, expect, it } from 'vitest';
import { excelWeight, formatWeight, parseWeight } from './weight';

describe('formatWeight', () => {
  it('attaches the unit to the value', () => {
    expect(formatWeight('500', 'g')).toBe('500g');
    expect(formatWeight('', 'g')).toBe('');
  });
  it('shows 1000g+ as kg and 1000ml+ as L', () => {
    expect(formatWeight('1500', 'g')).toBe('1.5kg');
    expect(formatWeight('1000', 'ml')).toBe('1L');
    expect(formatWeight('2.5', 'kg')).toBe('2.5kg');
    expect(formatWeight('999', 'g')).toBe('999g');
  });
});

describe('excelWeight', () => {
  it('only emits g and ml', () => {
    expect(excelWeight('1.5', 'kg')).toEqual({ value: 1500, unit: 'g' });
    expect(excelWeight('2', 'L')).toEqual({ value: 2000, unit: 'ml' });
    expect(excelWeight('500', 'g')).toEqual({ value: 500, unit: 'g' });
    expect(excelWeight('0,25', 'kg')).toEqual({ value: 250, unit: 'g' });
  });
  it('keeps text weights and empty weights as they are', () => {
    expect(excelWeight('한 봉지', 'g')).toEqual({ value: '한 봉지', unit: 'g' });
    expect(excelWeight('', 'kg')).toEqual({ value: '', unit: '' });
  });
});

describe('parseWeight', () => {
  it('splits value and unit', () => {
    expect(parseWeight('500g', 'g')).toEqual({ weight: '500', unit: 'g' });
    expect(parseWeight('1.5 kg', 'g')).toEqual({ weight: '1.5', unit: 'kg' });
    expect(parseWeight('2L', 'g')).toEqual({ weight: '2', unit: 'L' });
    expect(parseWeight(250, 'ml')).toEqual({ weight: '250', unit: 'ml' });
    expect(parseWeight('', 'g')).toEqual({ weight: '', unit: 'g' });
  });
});

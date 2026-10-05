import { describe, expect, it } from 'vitest';
import { parseNumber } from './NumberField';

describe('parseNumber', () => {
  it('acepta coma y punto decimal', () => {
    expect(parseNumber('42,5')).toBe(42.5);
    expect(parseNumber(' 42.5 ')).toBe(42.5);
    expect(parseNumber('450')).toBe(450);
    expect(parseNumber('-3')).toBe(-3);
  });
  it('rechaza texto no numérico', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('4 5')).toBeNull();
    expect(parseNumber('1e3')).toBeNull();
  });
});

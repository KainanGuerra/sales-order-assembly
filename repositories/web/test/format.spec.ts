import { describe, expect, it } from 'vitest';
import { basisPointsToInput, formatBasisPoints, formatCents, parsePercentToBasisPoints } from '../app/utils/format';

// Intl puts a non-breaking space after "R$"; compare without caring which space.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatCents', () => {
  it('shows reais and cents the Brazilian way', () => {
    expect(plain(formatCents(32280))).toBe('R$ 322,80');
    expect(plain(formatCents(5))).toBe('R$ 0,05');
    expect(plain(formatCents(123456789))).toBe('R$ 1.234.567,89');
  });
});

describe('formatBasisPoints', () => {
  it('shows basis points as a percentage', () => {
    expect(formatBasisPoints(500)).toBe('5%');
    expect(formatBasisPoints(250)).toBe('2,5%');
    expect(formatBasisPoints(0)).toBe('0%');
  });
});

describe('parsePercentToBasisPoints', () => {
  it.each([
    ['5', 500],
    ['2,5', 250],
    ['2.5', 250],
    ['5%', 500],
    [' 7 ', 700],
    ['0,01', 1],
    ['100', 10000],
  ])('reads %s as %i basis points', (text, bp) => {
    expect(parsePercentToBasisPoints(text)).toBe(bp);
  });

  it('reads an empty box as no discount', () => {
    expect(parsePercentToBasisPoints('')).toBe(0);
    expect(parsePercentToBasisPoints('   ')).toBe(0);
  });

  it.each(['abc', '-5', '1,234', '1,2,3', '5 5', 'NaN'])('rejects %s', (text) => {
    expect(parsePercentToBasisPoints(text)).toBeNull();
  });
});

describe('basisPointsToInput', () => {
  it('writes back what the person would type', () => {
    expect(basisPointsToInput(0)).toBe('');
    expect(basisPointsToInput(500)).toBe('5');
    expect(basisPointsToInput(250)).toBe('2,5');
  });

  it('round-trips with the parser', () => {
    for (const bp of [1, 50, 250, 500, 1234, 10000]) {
      expect(parsePercentToBasisPoints(basisPointsToInput(bp))).toBe(bp);
    }
  });
});

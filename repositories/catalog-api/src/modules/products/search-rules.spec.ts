import { describe, expect, it } from 'vitest';
import {
  classify,
  isExactCodeQuery,
  isVisible,
  matchesExactCode,
  reasonFor,
} from './search-rules.js';

describe('classify', () => {
  it('marks an active product with a price as available', () => {
    expect(classify({ active: true, unitPriceCents: 749 })).toBe('AVAILABLE');
  });

  it('marks an active product missing from the table as no price', () => {
    expect(classify({ active: true, unitPriceCents: null })).toBe('NO_PRICE');
  });

  it('marks an inactive product as inactive even when it has a price', () => {
    expect(classify({ active: false, unitPriceCents: 749 })).toBe('INACTIVE');
  });
});

describe('reasonFor', () => {
  it('explains why a product cannot be sold', () => {
    expect(reasonFor('INACTIVE')).toBe('DISCONTINUED');
    expect(reasonFor('NO_PRICE')).toBe('NO_PRICE_IN_TABLE');
    expect(reasonFor('AVAILABLE')).toBeNull();
  });
});

describe('isExactCodeQuery', () => {
  it('recognises an EAN-13', () => {
    expect(isExactCodeQuery('7891831978575')).toBe(true);
  });

  it('recognises a SKU in any letter case, ignoring surrounding spaces', () => {
    expect(isExactCodeQuery(' sku-1020 ')).toBe(true);
  });

  it('does not treat words or short numbers as codes', () => {
    expect(isExactCodeQuery('arroz')).toBe(false);
    expect(isExactCodeQuery('12345')).toBe(false);
  });
});

describe('matchesExactCode', () => {
  const product = { ean: '7891853290372', sku: 'SKU-1020' };

  it('matches by EAN and by SKU', () => {
    expect(matchesExactCode('7891853290372', product)).toBe(true);
    expect(matchesExactCode('sku-1020', product)).toBe(true);
  });

  it('does not match a different code', () => {
    expect(matchesExactCode('7891853290373', product)).toBe(false);
  });
});

describe('isVisible', () => {
  it('always shows available products', () => {
    expect(isVisible('AVAILABLE', false, false)).toBe(true);
    expect(isVisible('AVAILABLE', false, true)).toBe(true);
  });

  it('shows an active product without a price only when the flag is on', () => {
    expect(isVisible('NO_PRICE', false, true)).toBe(true);
    expect(isVisible('NO_PRICE', false, false)).toBe(false);
  });

  it('hides an inactive product from text search', () => {
    expect(isVisible('INACTIVE', false, true)).toBe(false);
  });

  it('shows an inactive product on an exact code match when the flag is on', () => {
    expect(isVisible('INACTIVE', true, true)).toBe(true);
  });

  it('hides an inactive product even on an exact code match when the flag is off', () => {
    expect(isVisible('INACTIVE', true, false)).toBe(false);
  });
});

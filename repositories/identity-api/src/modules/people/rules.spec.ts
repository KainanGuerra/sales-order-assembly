import { describe, expect, it } from 'vitest';
import { availableCreditCents, canAccessPortfolio, effectivePriceTable, parseActor } from './rules.js';

describe('parseActor', () => {
  it('reads the forwarded user', () => {
    expect(parseActor({ 'x-user-id': 'V01', 'x-user-role': 'SELLER' })).toEqual({ role: 'SELLER', id: 'V01' });
  });

  it('rejects a missing id, a missing role and an unknown role', () => {
    expect(parseActor({ 'x-user-role': 'SELLER' })).toBeNull();
    expect(parseActor({ 'x-user-id': 'V01' })).toBeNull();
    expect(parseActor({ 'x-user-id': 'V01', 'x-user-role': 'ADMIN' })).toBeNull();
  });
});

describe('canAccessPortfolio', () => {
  const seller = { id: 'V01', supervisorId: 'S01' };

  it('lets a seller see their own portfolio', () => {
    expect(canAccessPortfolio({ role: 'SELLER', id: 'V01' }, seller)).toBe(true);
  });

  it("does not let a seller see another seller's portfolio", () => {
    expect(canAccessPortfolio({ role: 'SELLER', id: 'V02' }, seller)).toBe(false);
  });

  it('lets a supervisor see the portfolio of a seller they supervise', () => {
    expect(canAccessPortfolio({ role: 'SUPERVISOR', id: 'S01' }, seller)).toBe(true);
  });

  it('does not let a supervisor see a seller supervised by someone else', () => {
    expect(canAccessPortfolio({ role: 'SUPERVISOR', id: 'S02' }, seller)).toBe(false);
  });

  it('does not confuse a seller id with a supervisor id', () => {
    expect(canAccessPortfolio({ role: 'SUPERVISOR', id: 'V01' }, seller)).toBe(false);
  });
});

describe('effectivePriceTable', () => {
  it("keeps the client's own table", () => {
    expect(effectivePriceTable({ priceTableId: 'TP02' }, 'TP01')).toEqual({ priceTableId: 'TP02', fallback: false });
  });

  it('falls back to the default table and says so', () => {
    expect(effectivePriceTable({ priceTableId: null }, 'TP01')).toEqual({ priceTableId: 'TP01', fallback: true });
  });
});

describe('availableCreditCents', () => {
  it('is the limit minus what is used', () => {
    expect(availableCreditCents({ creditLimitCents: 1_200_000, creditUsedCents: 1_165_000 })).toBe(35_000);
  });

  it('is zero when the limit is fully used', () => {
    expect(availableCreditCents({ creditLimitCents: 450_000, creditUsedCents: 450_000 })).toBe(0);
  });

  it('never goes negative', () => {
    expect(availableCreditCents({ creditLimitCents: 100, creditUsedCents: 150 })).toBe(0);
  });
});

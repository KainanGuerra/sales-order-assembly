import { describe, expect, it } from 'vitest';
import { availableCreditCents, canAccessPortfolio, creditInUseCents, effectivePriceTable, fitsInCredit, isHolding, parseActor, type Reservation } from './rules.js';

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

const now = new Date('2026-10-24T12:00:00Z');
const later = new Date('2026-10-24T12:15:00Z');
const earlier = new Date('2026-10-24T11:45:00Z');
const hold = (status: Reservation['status'], amountCents: number, expiresAt: Date): Reservation => ({ status, amountCents, expiresAt });

describe('isHolding', () => {
  it('counts a confirmed order whatever its date', () => {
    expect(isHolding(hold('CONFIRMED', 100, earlier), now)).toBe(true);
  });

  it('counts a pending hold until it expires', () => {
    expect(isHolding(hold('PENDING', 100, later), now)).toBe(true);
  });

  it('stops counting a pending hold at the moment it expires', () => {
    expect(isHolding(hold('PENDING', 100, now), now)).toBe(false);
    expect(isHolding(hold('PENDING', 100, earlier), now)).toBe(false);
  });

  it('never counts a released one', () => {
    expect(isHolding(hold('RELEASED', 100, later), now)).toBe(false);
  });
});

describe('creditInUseCents', () => {
  it('adds the live holds to what was already used', () => {
    const reservations = [hold('CONFIRMED', 10_000, earlier), hold('PENDING', 5_000, later), hold('PENDING', 7_000, earlier), hold('RELEASED', 9_000, later)];
    expect(creditInUseCents(120_000, reservations, now)).toBe(135_000);
  });

  it('is the base when there are no holds', () => {
    expect(creditInUseCents(120_000, [], now)).toBe(120_000);
  });
});

describe('fitsInCredit', () => {
  it('fits when the amount is exactly what is left', () => {
    expect(fitsInCredit(1_200_000, 1_165_000, 35_000)).toBe(true);
  });

  it('does not fit one cent over', () => {
    expect(fitsInCredit(1_200_000, 1_165_000, 35_001)).toBe(false);
  });

  it('never fits when the credit is already over its limit', () => {
    expect(fitsInCredit(100, 150, 1)).toBe(false);
  });
});

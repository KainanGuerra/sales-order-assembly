// Pure rules about who may see what. No I/O.

export type Role = 'SELLER' | 'SUPERVISOR';

export interface Actor {
  role: Role;
  id: string;
}

export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';

// The BFF forwards who is acting, after validating the browser session.
export function parseActor(headers: Record<string, string | string[] | undefined>): Actor | null {
  const id = headers[USER_ID_HEADER];
  const role = headers[USER_ROLE_HEADER];
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  if (role !== 'SELLER' && role !== 'SUPERVISOR') {
    return null;
  }
  return { role, id };
}

// A seller sees only their own portfolio. A supervisor sees the portfolios of
// the sellers they supervise.
export function canAccessPortfolio(actor: Actor, seller: { id: string; supervisorId: string }): boolean {
  return actor.role === 'SELLER' ? actor.id === seller.id : actor.id === seller.supervisorId;
}

// A client without a price table uses the default one, and the caller is told.
export function effectivePriceTable(
  client: { priceTableId: string | null },
  defaultPriceTableId: string,
): { priceTableId: string; fallback: boolean } {
  return client.priceTableId
    ? { priceTableId: client.priceTableId, fallback: false }
    : { priceTableId: defaultPriceTableId, fallback: true };
}

export function availableCreditCents(client: { creditLimitCents: number; creditUsedCents: number }): number {
  return Math.max(0, client.creditLimitCents - client.creditUsedCents);
}

// ---- Credit -------------------------------------------------------------
// What is spoken for = what the client had already used (from the seed), plus
// the orders that were sent, plus the holds that have not expired. Available
// credit is the limit minus that. These are pure so every edge is a unit test.

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED';

export interface Reservation {
  status: ReservationStatus;
  amountCents: number;
  expiresAt: Date;
}

// A confirmed order always counts. A pending hold counts only until it expires.
// A released one never counts.
export function isHolding(reservation: Reservation, now: Date): boolean {
  if (reservation.status === 'CONFIRMED') {
    return true;
  }
  return reservation.status === 'PENDING' && reservation.expiresAt.getTime() > now.getTime();
}

export function creditInUseCents(baseUsedCents: number, reservations: Reservation[], now: Date): number {
  return reservations.reduce((sum, r) => (isHolding(r, now) ? sum + r.amountCents : sum), baseUsedCents);
}

// The amount fits when it is no more than what is left, to the cent.
export function fitsInCredit(limitCents: number, inUseCents: number, amountCents: number): boolean {
  return amountCents <= limitCents - inUseCents;
}

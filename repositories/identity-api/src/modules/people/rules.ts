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

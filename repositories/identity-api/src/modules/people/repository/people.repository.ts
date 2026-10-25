import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { clients, creditReservations, sellers, supervisors } from '../../../db/schema.js';

export type SellerRow = typeof sellers.$inferSelect;
export type SupervisorRow = typeof supervisors.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;

@Injectable()
export class PeopleRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  listSupervisors(): Promise<SupervisorRow[]> {
    return this.db.select().from(supervisors).orderBy(asc(supervisors.name));
  }

  listSellers(): Promise<SellerRow[]> {
    return this.db.select().from(sellers).orderBy(asc(sellers.name));
  }

  async findSupervisor(id: string): Promise<SupervisorRow | null> {
    const [row] = await this.db.select().from(supervisors).where(eq(supervisors.id, id));
    return row ?? null;
  }

  async findSeller(id: string): Promise<SellerRow | null> {
    const [row] = await this.db.select().from(sellers).where(eq(sellers.id, id));
    return row ?? null;
  }

  listClientsBySeller(sellerId: string): Promise<ClientRow[]> {
    return this.db.select().from(clients).where(eq(clients.sellerId, sellerId)).orderBy(asc(clients.tradeName));
  }

  async findClient(id: string): Promise<ClientRow | null> {
    const [row] = await this.db.select().from(clients).where(eq(clients.id, id));
    return row ?? null;
  }

  // Credit held by reservations, per client: the orders that were sent plus the
  // holds that have not expired. The client's own "already used" amount is not
  // in here; it is a column of the client.
  async holdsByClient(clientIds: string[], now: Date): Promise<Map<string, number>> {
    if (clientIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({
        clientId: creditReservations.clientId,
        total: sql<number>`coalesce(sum(${creditReservations.amountCents}), 0)::int`,
      })
      .from(creditReservations)
      .where(and(inArray(creditReservations.clientId, clientIds), holdingNow(now)))
      .groupBy(creditReservations.clientId);
    return new Map(rows.map((row) => [row.clientId, row.total]));
  }

  // Holds credit for an order, atomically. The client's row is locked for the
  // length of the transaction, so two reservations for the same client are
  // decided one after the other, each seeing the one before it: that is what
  // keeps two orders sent at once from both fitting in credit that fits one.
  // Returns null when the client does not exist.
  async reserve(request: {
    clientId: string;
    orderId: string;
    amountCents: number;
    ttlSeconds: number;
    now: Date;
  }): Promise<{ reserved: boolean; availableCents: number } | null> {
    return this.db.transaction(async (tx) => {
      const [client] = await tx.select().from(clients).where(eq(clients.id, request.clientId)).for('update');
      if (!client) {
        return null;
      }

      const [existing] = await tx.select().from(creditReservations).where(eq(creditReservations.orderId, request.orderId));
      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${creditReservations.amountCents}), 0)::int` })
        .from(creditReservations)
        .where(and(eq(creditReservations.clientId, request.clientId), holdingNow(request.now)));
      const inUse = client.creditUsedCents + total;
      const available = Math.max(0, client.creditLimitCents - inUse);

      // The same order again: the hold it already has is the answer.
      if (existing && existing.clientId === request.clientId && existing.status !== 'RELEASED') {
        return { reserved: true, availableCents: available };
      }
      if (request.amountCents > client.creditLimitCents - inUse) {
        return { reserved: false, availableCents: available };
      }

      const expiresAt = new Date(request.now.getTime() + request.ttlSeconds * 1000);
      await tx
        .insert(creditReservations)
        .values({ orderId: request.orderId, clientId: request.clientId, amountCents: request.amountCents, status: 'PENDING', expiresAt })
        .onConflictDoUpdate({
          target: creditReservations.orderId,
          set: { clientId: request.clientId, amountCents: request.amountCents, status: 'PENDING', expiresAt },
        });
      return { reserved: true, availableCents: available - request.amountCents };
    });
  }

  // The order was sent: its credit now counts until it is released. A hold that
  // already lapsed is confirmed all the same, and an order that has no hold at
  // all (it was lost) gets one, so credit always reflects the orders that exist.
  // A released hold is never brought back by a repeated event.
  async confirm(request: { orderId: string; clientId: string; amountCents: number; now: Date }): Promise<void> {
    await this.db
      .insert(creditReservations)
      .values({
        orderId: request.orderId,
        clientId: request.clientId,
        amountCents: request.amountCents,
        status: 'CONFIRMED',
        expiresAt: request.now,
      })
      .onConflictDoUpdate({
        target: creditReservations.orderId,
        set: { status: 'CONFIRMED', amountCents: request.amountCents },
        setWhere: eq(creditReservations.status, 'PENDING'),
      });
  }

  // Gives the credit back. Idempotent.
  async release(orderId: string): Promise<void> {
    await this.db
      .update(creditReservations)
      .set({ status: 'RELEASED' })
      .where(and(eq(creditReservations.orderId, orderId), or(eq(creditReservations.status, 'PENDING'), eq(creditReservations.status, 'CONFIRMED'))));
  }
}

// A confirmed order always counts; a pending hold only until it expires.
function holdingNow(now: Date) {
  return or(
    eq(creditReservations.status, 'CONFIRMED'),
    and(eq(creditReservations.status, 'PENDING'), gt(creditReservations.expiresAt, now)),
  );
}

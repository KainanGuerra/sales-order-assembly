import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { orderItems, orderStatusHistory, orders } from '../../../db/schema.js';

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type HistoryRow = typeof orderStatusHistory.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type NewHistory = Omit<typeof orderStatusHistory.$inferInsert, 'id' | 'orderId' | 'createdAt'>;

export interface OrderWithItems {
  order: OrderRow;
  items: OrderItemRow[];
  history: HistoryRow[];
}

// Postgres "unique_violation", and the name of the orders primary key. Only a
// clash on the order id means "this order already exists"; any other unique
// violation (a repeated line, for example) is a real error.
const UNIQUE_VIOLATION = '23505';
const ORDERS_PRIMARY_KEY = 'orders_pkey';

@Injectable()
export class OrdersRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findById(id: string): Promise<OrderWithItems | null> {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id));
    if (!order) {
      return null;
    }
    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.productId));
    const history = await this.db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.id));
    return { order, items, history };
  }

  // Inserts the order, its lines and its first history step in one transaction.
  // Returns false when an order with this id already exists (a repeated submit,
  // or two at once): the primary key is what makes the submit idempotent, not a
  // prior read.
  async insert(order: NewOrder, items: NewOrderItem[], firstStep: NewHistory): Promise<boolean> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(orders).values(order);
        await tx.insert(orderItems).values(items);
        await tx.insert(orderStatusHistory).values({ ...firstStep, orderId: order.id! });
      });
      return true;
    } catch (error) {
      if (isDuplicateOrderId(error)) {
        return false;
      }
      throw error;
    }
  }

  // Brings in an order that came with the seed: the order, its lines and its one
  // history step, all or nothing. Importing again changes nothing (the id is the
  // same every time), so the import can run at every start.
  async insertImported(order: NewOrder, items: NewOrderItem[], step: NewHistory & { createdAt: Date }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx.insert(orders).values(order).onConflictDoNothing().returning({ id: orders.id });
      if (inserted.length === 0) {
        return false;
      }
      await tx.insert(orderItems).values(items);
      await tx.insert(orderStatusHistory).values({ ...step, orderId: order.id! });
      return true;
    });
  }

  // How many lines each of these orders has.
  async itemCounts(orderIds: string[]): Promise<Map<string, number>> {
    if (orderIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ orderId: orderItems.orderId, count: sql<number>`count(*)::int` })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId);
    return new Map(rows.map((row) => [row.orderId, row.count]));
  }

  // Orders waiting for this supervisor, oldest first.
  listPendingApproval(supervisorId: string, limit: number): Promise<OrderRow[]> {
    return this.db
      .select()
      .from(orders)
      .where(and(eq(orders.supervisorId, supervisorId), eq(orders.status, 'AWAITING_APPROVAL')))
      .orderBy(asc(orders.createdAt))
      .limit(limit);
  }

  // Approving, as one atomic step: the update only matches an order that is
  // still awaiting approval, so approve and reject sent at the same moment
  // cannot both win. Records APPROVED (by the supervisor) and then SUBMITTED
  // (by the system). Returns false when the order was no longer waiting.
  // Rejecting below is the mirror: REJECTED (by the supervisor), then CANCELLED.
  async applyApproval(orderId: string, supervisor: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(orders)
        .set({ status: 'SUBMITTED' })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'AWAITING_APPROVAL')))
        .returning({ id: orders.id });
      if (moved.length === 0) {
        return false;
      }
      await tx.insert(orderStatusHistory).values([
        { orderId, status: 'APPROVED', actor: `user:${supervisor}` },
        { orderId, status: 'SUBMITTED', actor: 'system:orders' },
      ]);
      return true;
    });
  }

  async applyRejection(
    orderId: string,
    supervisor: string,
    reason: { code: string; text: string | null },
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(orders)
        .set({ status: 'CANCELLED', rejectionReasonCode: reason.code, rejectionReasonText: reason.text })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'AWAITING_APPROVAL')))
        .returning({ id: orders.id });
      if (moved.length === 0) {
        return false;
      }
      // The supervisor's refusal (with its reason), then the cancellation it causes.
      await tx.insert(orderStatusHistory).values([
        { orderId, status: 'REJECTED', actor: `user:${supervisor}`, reasonCode: reason.code, reasonText: reason.text },
        { orderId, status: 'CANCELLED', actor: 'system:orders' },
      ]);
      return true;
    });
  }

  listBySeller(sellerId: string, limit: number): Promise<OrderRow[]> {
    return this.db
      .select()
      .from(orders)
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  listByClient(sellerId: string, clientId: string, limit: number): Promise<OrderRow[]> {
    return this.db
      .select()
      .from(orders)
      .where(and(eq(orders.sellerId, sellerId), eq(orders.clientId, clientId)))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }
}

function isDuplicateOrderId(error: unknown): boolean {
  // Drizzle wraps the driver error; the Postgres details are on the cause.
  const candidates = [error, (error as { cause?: unknown })?.cause] as ({ code?: string; constraint?: string } | undefined)[];
  return candidates.some((c) => c?.code === UNIQUE_VIOLATION && c.constraint === ORDERS_PRIMARY_KEY);
}

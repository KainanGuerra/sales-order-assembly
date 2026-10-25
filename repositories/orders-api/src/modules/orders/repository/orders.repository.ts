import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { orderItems, orders } from '../../../db/schema.js';

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type NewOrderItem = typeof orderItems.$inferInsert;

export interface OrderWithItems {
  order: OrderRow;
  items: OrderItemRow[];
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
    return { order, items };
  }

  // Inserts the order and its lines in one transaction. Returns false when an
  // order with this id already exists (a repeated submit, or two at once): the
  // primary key is what makes the submit idempotent, not a prior read.
  async insert(order: NewOrder, items: NewOrderItem[]): Promise<boolean> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(orders).values(order);
        await tx.insert(orderItems).values(items);
      });
      return true;
    } catch (error) {
      if (isDuplicateOrderId(error)) {
        return false;
      }
      throw error;
    }
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

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { countedOrders, productStats } from '../../../db/schema.js';

export interface OrderedItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class ProductStatsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Adds an order's units to the product totals, once. Marking the order and
  // adding the units are one transaction, so a failure leaves neither behind
  // and the redelivery starts clean. Returns false when the order was already
  // counted.
  async countOrder(orderId: string, items: OrderedItem[]): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const marked = await tx
        .insert(countedOrders)
        .values({ orderId })
        .onConflictDoNothing()
        .returning({ orderId: countedOrders.orderId });
      if (marked.length === 0) {
        return false;
      }

      // A product may appear on two lines; the upsert needs one row per product.
      const unitsByProduct = new Map<string, number>();
      for (const item of items) {
        unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) ?? 0) + item.quantity);
      }
      await tx
        .insert(productStats)
        .values([...unitsByProduct].map(([productId, unitsOrdered]) => ({ productId, unitsOrdered })))
        .onConflictDoUpdate({
          target: productStats.productId,
          set: { unitsOrdered: sql`${productStats.unitsOrdered} + excluded.units_ordered` },
        });
      return true;
    });
  }
}

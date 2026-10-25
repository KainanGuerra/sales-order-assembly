import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

// Tables are unqualified on purpose: the connection's search_path decides the
// schema ("catalog" in the service, "catalog_test" in tests).

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    sku: text('sku').notNull().unique(),
    // Not unique: the seed contains two different products with the same EAN.
    ean: text('ean').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    brand: text('brand').notNull(),
    // UN, FD or CX.
    saleUnit: text('sale_unit').notNull(),
    // Units per pack; 1 when sold by the unit.
    packFactor: integer('pack_factor').notNull(),
    // When true, quantities in units must be multiples of packFactor.
    multipleOnly: boolean('multiple_only').notNull(),
    active: boolean('active').notNull(),
  },
  (table) => [index('products_ean_idx').on(table.ean)],
);

export const priceTables = pgTable('price_tables', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const priceTableItems = pgTable(
  'price_table_items',
  {
    priceTableId: text('price_table_id')
      .notNull()
      .references(() => priceTables.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    // Price of ONE unit, in cents.
    unitPriceCents: integer('unit_price_cents').notNull(),
  },
  (table) => [primaryKey({ columns: [table.priceTableId, table.productId] })],
);

// Units ordered per product, counted from the order.submitted events. No
// foreign key to products on purpose: an event naming a product this catalog
// does not know must not fail forever and end in the dead-letter queue.
export const productStats = pgTable('product_stats', {
  productId: text('product_id').primaryKey(),
  unitsOrdered: integer('units_ordered').notNull(),
});

// The orders already counted. The primary key makes the count idempotent: a
// redelivered event inserts nothing, so it adds nothing.
export const countedOrders = pgTable('counted_orders', {
  orderId: text('order_id').primaryKey(),
  countedAt: timestamp('counted_at', { withTimezone: true }).notNull().defaultNow(),
});

import { boolean, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

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

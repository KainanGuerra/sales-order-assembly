import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';

// Tables are unqualified on purpose: the connection's search_path decides the
// schema ("identity" in the service, "identity_test" in tests).

export const supervisors = pgTable('supervisors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const sellers = pgTable('sellers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  supervisorId: text('supervisor_id')
    .notNull()
    .references(() => supervisors.id),
  // Largest discount the seller may grant without approval, in basis points
  // (1% = 100).
  discountLimitBp: integer('discount_limit_bp').notNull(),
});

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    tradeName: text('trade_name').notNull(),
    legalName: text('legal_name').notNull(),
    cnpj: text('cnpj').notNull().unique(),
    // The seller whose portfolio holds the client.
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    // Id of a table owned by the catalog (no foreign key across services).
    // Null when the client has none.
    priceTableId: text('price_table_id'),
    creditLimitCents: integer('credit_limit_cents').notNull(),
    creditUsedCents: integer('credit_used_cents').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
  },
  (table) => [index('clients_seller_idx').on(table.sellerId)],
);

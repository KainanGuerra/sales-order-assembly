import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

// Tables are unqualified on purpose: the connection's search_path decides the
// schema ("notifications" in the service, "notifications_test" in tests).

// One row per message to one person about one order.
//  - read_at: the person opened it.
//  - resolved_at: it asked for something (a decision) and that is no longer
//    needed, because the order was decided.
// The same event delivered twice cannot add a second row: (order, person, kind)
// is unique.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The id of a seller or supervisor, as identity knows it (no foreign key
    // across services).
    recipientId: text('recipient_id').notNull(),
    recipientRole: text('recipient_role').notNull(),
    // What happened, as a code. The words are the screen's business.
    kind: text('kind').notNull(),
    orderId: uuid('order_id').notNull(),
    // What the words need: the client's name, the amount, a reason...
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    unique('notifications_order_recipient_kind_unique').on(table.orderId, table.recipientId, table.kind),
    index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt),
    index('notifications_order_idx').on(table.orderId),
  ],
);

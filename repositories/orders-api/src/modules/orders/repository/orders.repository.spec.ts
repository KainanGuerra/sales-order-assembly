import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { OrdersRepository, type NewOrder, type NewOrderItem } from './orders.repository.js';

// Runs against the Postgres from docker compose, in the separate "orders_test"
// schema (same owner, same migrations). Skipped when no database is given:
//   TEST_DATABASE_URL=postgres://orders_role:<password>@127.0.0.1:5432/sales pnpm test
const url = process.env.TEST_DATABASE_URL;
const TEST_SCHEMA = 'orders_test';

const order = (id: string, overrides: Partial<NewOrder> = {}): NewOrder => ({
  id,
  sellerId: 'V01',
  clientId: 'C001',
  priceTableId: 'TP01',
  status: 'SUBMITTED',
  subtotalCents: 50_000,
  orderDiscountBp: 0,
  orderDiscountCents: 0,
  totalCents: 50_000,
  approvalReasons: [],
  ...overrides,
});

const item = (orderId: string, productId: string): NewOrderItem => ({
  orderId,
  productId,
  sku: `SKU-${productId}`,
  description: `Product ${productId}`,
  unit: 'UNIT',
  quantityInput: 5,
  quantityUnits: 5,
  packFactor: 1,
  unitPriceCents: 10_000,
  discountBp: 0,
  grossCents: 50_000,
  netCents: 50_000,
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe.skipIf(!url)('OrdersRepository (real Postgres)', () => {
  let pool: Pool;
  let db: Database;
  let repository: OrdersRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
    repository = new OrdersRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table order_items, orders cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('saves an order with its lines and reads it back', async () => {
    expect(await repository.insert(order(A), [item(A, 'P1'), item(A, 'P2')])).toBe(true);
    const found = await repository.findById(A);
    expect(found?.order).toMatchObject({ id: A, status: 'SUBMITTED', totalCents: 50_000 });
    expect(found?.items.map((i) => i.productId)).toEqual(['P1', 'P2']);
  });

  it('answers null for an unknown order', async () => {
    expect(await repository.findById(A)).toBeNull();
  });

  it('refuses a second order with the same id and reports it, without touching the first', async () => {
    await repository.insert(order(A), [item(A, 'P1')]);
    expect(await repository.insert(order(A, { totalCents: 1 }), [item(A, 'P9')])).toBe(false);
    const found = await repository.findById(A);
    expect(found?.order.totalCents).toBe(50_000);
    expect(found?.items.map((i) => i.productId)).toEqual(['P1']);
  });

  it('settles two submits of the same id sent at once: exactly one wins', async () => {
    const results = await Promise.all([
      repository.insert(order(A), [item(A, 'P1')]),
      repository.insert(order(A), [item(A, 'P1')]),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('saves nothing when a line is rejected: the order and its lines are one transaction', async () => {
    // The same product twice breaks the (order, product) primary key.
    await expect(repository.insert(order(A), [item(A, 'P1'), item(A, 'P1')])).rejects.toThrow();
    expect(await repository.findById(A)).toBeNull();
  });

  it('keeps jsonb approval reasons as they were', async () => {
    const reasons = [{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P1', discountBp: 600 }];
    await repository.insert(order(A, { status: 'AWAITING_APPROVAL', approvalReasons: reasons }), [item(A, 'P1')]);
    expect((await repository.findById(A))?.order.approvalReasons).toEqual(reasons);
  });

  it('lists the orders of a seller, newest first, and never another seller\'s', async () => {
    await repository.insert(order(A), [item(A, 'P1')]);
    await repository.insert(order(B), [item(B, 'P1')]);
    await repository.insert(order(C, { sellerId: 'V02' }), [item(C, 'P1')]);
    const rows = await repository.listBySeller('V01', 10);
    expect(rows.map((r) => r.id)).toEqual([B, A]);
  });

  it('lists the orders of one client of a seller', async () => {
    await repository.insert(order(A, { clientId: 'C001' }), [item(A, 'P1')]);
    await repository.insert(order(B, { clientId: 'C002' }), [item(B, 'P1')]);
    expect((await repository.listByClient('V01', 'C002', 10)).map((r) => r.id)).toEqual([B]);
  });
});

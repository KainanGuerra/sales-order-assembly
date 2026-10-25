import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { OrdersRepository, type NewHistory, type NewOrder, type NewOrderItem } from './orders.repository.js';

// Runs against the Postgres from docker compose, in the separate "orders_test"
// schema (same owner, same migrations). Skipped when no database is given:
//   TEST_DATABASE_URL=postgres://orders_role:<password>@127.0.0.1:5432/sales pnpm test
const url = process.env.TEST_DATABASE_URL;
const TEST_SCHEMA = 'orders_test';

const order = (id: string, overrides: Partial<NewOrder> = {}): NewOrder => ({
  id,
  sellerId: 'V01',
  sellerName: 'Carlos Menezes',
  supervisorId: 'S01',
  clientId: 'C001',
  clientTradeName: 'Mercadinho São José',
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

const first = (status: NewHistory['status'] = 'SUBMITTED'): NewHistory => ({ status, actor: 'user:V01' });
const waiting = (id: string, overrides: Partial<NewOrder> = {}) => order(id, { status: 'AWAITING_APPROVAL', ...overrides });

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
    await db.execute(sql`truncate table order_status_history, order_items, orders cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('saving', () => {
    it('saves an order with its lines and its first step, and reads them back', async () => {
      expect(await repository.insert(order(A), [item(A, 'P1'), item(A, 'P2')], first())).toBe(true);
      const found = await repository.findById(A);
      expect(found?.order).toMatchObject({ id: A, status: 'SUBMITTED', totalCents: 50_000, supervisorId: 'S01', sellerName: 'Carlos Menezes' });
      expect(found?.items.map((i) => i.productId)).toEqual(['P1', 'P2']);
      expect(found?.history.map((h) => [h.status, h.actor])).toEqual([['SUBMITTED', 'user:V01']]);
    });

    it('answers null for an unknown order', async () => {
      expect(await repository.findById(A)).toBeNull();
    });

    it('refuses a second order with the same id and reports it, without touching the first', async () => {
      await repository.insert(order(A), [item(A, 'P1')], first());
      expect(await repository.insert(order(A, { totalCents: 1 }), [item(A, 'P9')], first())).toBe(false);
      const found = await repository.findById(A);
      expect(found?.order.totalCents).toBe(50_000);
      expect(found?.items.map((i) => i.productId)).toEqual(['P1']);
      expect(found?.history).toHaveLength(1);
    });

    it('settles two submits of the same id sent at once: exactly one wins', async () => {
      const results = await Promise.all([
        repository.insert(order(A), [item(A, 'P1')], first()),
        repository.insert(order(A), [item(A, 'P1')], first()),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('saves nothing when a line is rejected: the order, its lines and its first step are one transaction', async () => {
      // The same product twice breaks the (order, product) primary key.
      await expect(repository.insert(order(A), [item(A, 'P1'), item(A, 'P1')], first())).rejects.toThrow();
      expect(await repository.findById(A)).toBeNull();
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.orderStatusHistory);
      expect(count).toBe(0);
    });

    it('keeps jsonb approval reasons as they were', async () => {
      const reasons = [{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P1', discountBp: 600 }];
      await repository.insert(waiting(A, { approvalReasons: reasons }), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      expect((await repository.findById(A))?.order.approvalReasons).toEqual(reasons);
    });
  });

  describe('approval', () => {
    it('moves an order awaiting approval to SUBMITTED and records APPROVED, then SUBMITTED, in that order', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      expect(await repository.applyApproval(A, 'S01')).toBe(true);
      const found = await repository.findById(A);
      expect(found?.order.status).toBe('SUBMITTED');
      expect(found?.history.map((h) => [h.status, h.actor])).toEqual([
        ['AWAITING_APPROVAL', 'user:V01'],
        ['APPROVED', 'user:S01'],
        ['SUBMITTED', 'system:orders'],
      ]);
    });

    it('does not approve an order twice, or one that was never waiting, and records nothing for the attempt', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      await repository.insert(order(B), [item(B, 'P1')], first());
      expect(await repository.applyApproval(A, 'S01')).toBe(true);
      expect(await repository.applyApproval(A, 'S01')).toBe(false);
      expect(await repository.applyApproval(B, 'S01')).toBe(false);
      expect((await repository.findById(A))?.history).toHaveLength(3);
      expect((await repository.findById(B))?.history).toHaveLength(1);
    });

    it('does not approve an order that was rejected', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      await repository.applyRejection(A, 'S01', { code: 'CREDIT_RISK', text: null });
      expect(await repository.applyApproval(A, 'S01')).toBe(false);
      expect((await repository.findById(A))?.order.status).toBe('CANCELLED');
    });
  });

  describe('rejection', () => {
    it('rejects an order awaiting approval and keeps the reason and who did it', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      expect(await repository.applyRejection(A, 'S01', { code: 'OTHER', text: 'Cliente desistiu' })).toBe(true);
      const found = await repository.findById(A);
      expect(found?.order).toMatchObject({ status: 'CANCELLED', rejectionReasonCode: 'OTHER', rejectionReasonText: 'Cliente desistiu' });
      // REJECTED (by the supervisor, with the reason) and then CANCELLED (by the system), in that order.
      expect(found?.history.map((h) => [h.status, h.actor])).toEqual([
        ['AWAITING_APPROVAL', 'user:V01'],
        ['REJECTED', 'user:S01'],
        ['CANCELLED', 'system:orders'],
      ]);
      expect(found?.history[1]).toMatchObject({ reasonCode: 'OTHER', reasonText: 'Cliente desistiu' });
    });

    it('does not reject an order that was already sent', async () => {
      await repository.insert(order(A), [item(A, 'P1')], first());
      expect(await repository.applyRejection(A, 'S01', { code: 'CREDIT_RISK', text: null })).toBe(false);
      expect((await repository.findById(A))?.order.status).toBe('SUBMITTED');
    });

    it('does not reject an approved order', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      await repository.applyApproval(A, 'S01');
      expect(await repository.applyRejection(A, 'S01', { code: 'CREDIT_RISK', text: null })).toBe(false);
    });
  });

  // Forces the interleaving: one transaction holds the order's row, an approval
  // and a rejection both start and queue behind it, then it lets go. Exactly one
  // decision may win; without the "still waiting" condition both would.
  it('lets exactly one of an approval and a rejection decide an order when they arrive together', async () => {
    await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [A]);

      let settled = 0;
      const approval = repository.applyApproval(A, 'S01').then((r) => ((settled += 1), r));
      const rejection = repository.applyRejection(A, 'S01', { code: 'CREDIT_RISK', text: null }).then((r) => ((settled += 1), r));
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(settled).toBe(0);

      await holder.query('COMMIT');
      const results = await Promise.all([approval, rejection]);
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      holder.release();
    }
    const found = await repository.findById(A);
    expect(['SUBMITTED', 'CANCELLED']).toContain(found?.order.status);
    // The history matches the winner and has no steps from the loser.
    const steps = found!.history.map((h) => h.status);
    expect(steps).toEqual(
      found?.order.status === 'SUBMITTED' ? ['AWAITING_APPROVAL', 'APPROVED', 'SUBMITTED'] : ['AWAITING_APPROVAL', 'REJECTED', 'CANCELLED'],
    );
  });

  describe('imported orders', () => {
    const imported = (id: string): NewOrder => order(id, { status: 'INVOICED', origin: 'IMPORTED', createdAt: new Date('2026-09-15T12:00:00Z') });
    const step = { status: 'INVOICED', actor: 'system:import', createdAt: new Date('2026-09-15T12:00:00Z') };

    it('brings in an order with its lines and its one step, dated as the file says', async () => {
      expect(await repository.insertImported(imported(A), [item(A, 'P1'), item(A, 'P2')], step)).toBe(true);
      const found = await repository.findById(A);
      expect(found?.order).toMatchObject({ status: 'INVOICED', origin: 'IMPORTED' });
      expect(found?.order.createdAt.toISOString()).toBe('2026-09-15T12:00:00.000Z');
      expect(found?.items).toHaveLength(2);
      expect(found?.history.map((h) => [h.status, h.actor])).toEqual([['INVOICED', 'system:import']]);
    });

    it('importing the same order again changes nothing and says so', async () => {
      await repository.insertImported(imported(A), [item(A, 'P1')], step);
      expect(await repository.insertImported(imported(A), [item(A, 'P1')], step)).toBe(false);
      const found = await repository.findById(A);
      expect(found?.items).toHaveLength(1);
      expect(found?.history).toHaveLength(1);
    });

    it('does not bring in a second line for the same product, and leaves nothing half-imported', async () => {
      await expect(repository.insertImported(imported(A), [item(A, 'P1'), item(A, 'P1')], step)).rejects.toThrow();
      expect(await repository.findById(A)).toBeNull();
    });

    it('marks an order made here as made here', async () => {
      await repository.insert(order(A), [item(A, 'P1')], first());
      expect((await repository.findById(A))?.order.origin).toBe('SYSTEM');
    });
  });

  describe('counting lines', () => {
    it('counts the lines of each order, and is happy with no ids', async () => {
      await repository.insert(order(A), [item(A, 'P1'), item(A, 'P2'), item(A, 'P3')], first());
      await repository.insert(order(B), [item(B, 'P1')], first());
      expect(await repository.itemCounts([A, B, C])).toEqual(new Map([[A, 3], [B, 1]]));
      expect(await repository.itemCounts([])).toEqual(new Map());
    });
  });

  describe('lists', () => {
    it("lists only the orders awaiting approval of one supervisor's team, oldest first", async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      await repository.insert(waiting(B), [item(B, 'P1')], first('AWAITING_APPROVAL'));
      await repository.insert(waiting(C, { supervisorId: 'S02' }), [item(C, 'P1')], first('AWAITING_APPROVAL'));
      await repository.insert(order('44444444-4444-4444-8444-444444444444'), [item('44444444-4444-4444-8444-444444444444', 'P1')], first());
      expect((await repository.listPendingApproval('S01', 10)).map((r) => r.id)).toEqual([A, B]);
      expect((await repository.listPendingApproval('S02', 10)).map((r) => r.id)).toEqual([C]);
    });

    it('stops listing an order once it is decided', async () => {
      await repository.insert(waiting(A), [item(A, 'P1')], first('AWAITING_APPROVAL'));
      await repository.applyApproval(A, 'S01');
      expect(await repository.listPendingApproval('S01', 10)).toEqual([]);
    });

    it("lists the orders of a seller, newest first, and never another seller's", async () => {
      await repository.insert(order(A), [item(A, 'P1')], first());
      await repository.insert(order(B), [item(B, 'P1')], first());
      await repository.insert(order(C, { sellerId: 'V02' }), [item(C, 'P1')], first());
      expect((await repository.listBySeller('V01', 10)).map((r) => r.id)).toEqual([B, A]);
    });

    it('lists the orders of one client of a seller', async () => {
      await repository.insert(order(A, { clientId: 'C001' }), [item(A, 'P1')], first());
      await repository.insert(order(B, { clientId: 'C002' }), [item(B, 'P1')], first());
      expect((await repository.listByClient('V01', 'C002', 10)).map((r) => r.id)).toEqual([B]);
    });
  });
});

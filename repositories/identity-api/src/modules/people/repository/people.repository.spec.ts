import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { clients } from '../../../db/schema.js';
import { SeedService } from '../../seed/seed.service.js';
import { PeopleRepository } from './people.repository.js';

// Runs against the Postgres from docker compose, in the separate "identity_test"
// schema (same owner, same migrations). Skipped when no database is given:
//   TEST_DATABASE_URL=postgres://identity_role:<password>@127.0.0.1:5432/sales pnpm test
const url = process.env.TEST_DATABASE_URL;
const TEST_SCHEMA = 'identity_test';
const seedFile = fileURLToPath(new URL('../../../../../../seed.json', import.meta.url));
const env = { SEED_FILE: seedFile } as Env;

describe.skipIf(!url)('PeopleRepository (real Postgres)', () => {
  let pool: Pool;
  let db: Database;
  let repository: PeopleRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
    await db.execute(sql`truncate table clients, sellers, supervisors cascade`);
    await new SeedService(db, env).onApplicationBootstrap();
    repository = new PeopleRepository(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('loads the delivered seed', async () => {
    expect(await repository.listSupervisors()).toHaveLength(1);
    expect(await repository.listSellers()).toHaveLength(3);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(clients);
    expect(count).toBe(10);
  });

  it('keeps the credit used by orders when the seed runs again', async () => {
    await db.execute(sql`update clients set credit_used_cents = 999 where id = 'C001'`);
    await new SeedService(db, env).onApplicationBootstrap();
    expect((await repository.findClient('C001'))?.creditUsedCents).toBe(999);
    await db.execute(sql`update clients set credit_used_cents = 120000 where id = 'C001'`);
  });

  it('lists only the clients of one seller', async () => {
    const rows = await repository.listClientsBySeller('V01');
    expect(rows.map((r) => r.id).sort()).toEqual(['C001', 'C002', 'C003', 'C004']);
    expect(rows.every((r) => r.sellerId === 'V01')).toBe(true);
  });

  it('splits the delivered portfolio 4/3/3 between the sellers', async () => {
    const counts = await Promise.all(['V01', 'V02', 'V03'].map(async (id) => (await repository.listClientsBySeller(id)).length));
    expect(counts).toEqual([4, 3, 3]);
  });

  it('stores money in cents and discount limits in basis points', async () => {
    expect((await repository.findClient('C002'))).toMatchObject({ creditLimitCents: 1_200_000, creditUsedCents: 1_165_000 });
    expect((await repository.findSeller('V02'))?.discountLimitBp).toBe(700);
  });

  it('keeps the client without a price table as null', async () => {
    expect((await repository.findClient('C004'))?.priceTableId).toBeNull();
  });

  it('answers null for unknown ids', async () => {
    expect(await repository.findClient('C999')).toBeNull();
    expect(await repository.findSeller('V99')).toBeNull();
    expect(await repository.findSupervisor('S99')).toBeNull();
  });

  it('rejects a client for a seller that does not exist (foreign key)', async () => {
    await expect(
      db.execute(sql`insert into clients (id, trade_name, legal_name, cnpj, seller_id, credit_limit_cents, credit_used_cents, city, state)
        values ('CX', 'x', 'x', '00', 'V99', 0, 0, 'x', 'x')`),
    ).rejects.toThrow();
  });
});

// ---- Credit reservations ---------------------------------------------------
describe.skipIf(!url)('PeopleRepository credit (real Postgres)', () => {
  let pool: Pool;
  let db: Database;
  let repository: PeopleRepository;
  const now = new Date('2026-10-24T12:00:00Z');
  const inMinutes = (n: number) => new Date(now.getTime() + n * 60_000);
  const O1 = '11111111-1111-4111-8111-111111111111';
  const O2 = '22222222-2222-4222-8222-222222222222';
  const O3 = '33333333-3333-4333-8333-333333333333';

  // C002: limit 12.000,00, used 11.650,00 -> 350,00 left. C003: limit 2.500,00, none used.
  const reserve = (orderId: string, clientId: string, amountCents: number, at = now) =>
    repository.reserve({ clientId, orderId, amountCents, ttlSeconds: 900, now: at });

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
    await db.execute(sql`truncate table credit_reservations, clients, sellers, supervisors cascade`);
    await new SeedService(db, env).onApplicationBootstrap();
    repository = new PeopleRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table credit_reservations`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('holds an amount that fits and says what is left', async () => {
    expect(await reserve(O1, 'C002', 30_000)).toEqual({ reserved: true, availableCents: 5_000 });
  });

  it('holds exactly what is left, to the cent', async () => {
    expect(await reserve(O1, 'C002', 35_000)).toEqual({ reserved: true, availableCents: 0 });
  });

  it('refuses one cent over, and holds nothing', async () => {
    expect(await reserve(O1, 'C002', 35_001)).toEqual({ reserved: false, availableCents: 35_000 });
    expect((await repository.holdsByClient(['C002'], now)).get('C002') ?? 0).toBe(0);
  });

  it('refuses the second order when the first took the credit', async () => {
    await reserve(O1, 'C002', 30_000);
    expect(await reserve(O2, 'C002', 30_000)).toEqual({ reserved: false, availableCents: 5_000 });
  });

  // Forces the interleaving instead of hoping for it: one transaction holds the
  // client's lock and, while it does, a reservation starts. Without the lock the
  // reservation would answer at once, without seeing the first order's hold.
  it('makes a reservation wait for the transaction that holds the client, then counts its hold', async () => {
    const first = await pool.connect();
    try {
      await first.query('BEGIN');
      await first.query("SELECT id FROM clients WHERE id = 'C002' FOR UPDATE");

      let settled = false;
      const second = reserve(O2, 'C002', 30_000).then((result) => {
        settled = true;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(settled).toBe(false);

      // The first order takes the credit while it still holds the lock.
      await first.query(
        "INSERT INTO credit_reservations (order_id, client_id, amount_cents, status, expires_at) VALUES ($1, 'C002', 30000, 'CONFIRMED', $2)",
        [O1, inMinutes(15)],
      );
      await first.query('COMMIT');

      expect(await second).toEqual({ reserved: false, availableCents: 5_000 });
    } finally {
      first.release();
    }
  });

  it('lets only one of two orders sent together hold the credit', async () => {
    const results = await Promise.all([reserve(O1, 'C002', 30_000), reserve(O2, 'C002', 30_000)]);
    expect(results.filter((r) => r?.reserved)).toHaveLength(1);
    expect((await repository.holdsByClient(['C002'], now)).get('C002')).toBe(30_000);
  });

  it('keeps the credit of different clients apart', async () => {
    await reserve(O1, 'C002', 35_000);
    expect(await reserve(O2, 'C003', 250_000)).toEqual({ reserved: true, availableCents: 0 });
  });

  it('answers the same way when the same order asks again, holding nothing extra', async () => {
    await reserve(O1, 'C002', 30_000);
    expect(await reserve(O1, 'C002', 30_000)).toEqual({ reserved: true, availableCents: 5_000 });
    expect((await repository.holdsByClient(['C002'], now)).get('C002')).toBe(30_000);
  });

  it('frees a hold by itself when it expires', async () => {
    await reserve(O1, 'C002', 35_000, now);
    expect((await reserve(O2, 'C002', 35_000, inMinutes(14)))?.reserved).toBe(false);
    expect((await reserve(O2, 'C002', 35_000, inMinutes(16)))?.reserved).toBe(true);
  });

  it('keeps counting a confirmed order after the hold would have expired', async () => {
    await reserve(O1, 'C002', 35_000, now);
    await repository.confirm({ orderId: O1, clientId: 'C002', amountCents: 35_000, now });
    expect((await reserve(O2, 'C002', 1, inMinutes(60)))?.reserved).toBe(false);
  });

  it('confirms an order whose hold had lapsed', async () => {
    await reserve(O1, 'C002', 35_000, now);
    await repository.confirm({ orderId: O1, clientId: 'C002', amountCents: 35_000, now: inMinutes(60) });
    expect((await repository.holdsByClient(['C002'], inMinutes(60))).get('C002')).toBe(35_000);
  });

  it('creates a confirmed hold for an order that has none, so credit reflects every order', async () => {
    await repository.confirm({ orderId: O3, clientId: 'C003', amountCents: 100_000, now });
    expect((await repository.holdsByClient(['C003'], now)).get('C003')).toBe(100_000);
  });

  it('gives the credit back on release, and a repeated release changes nothing', async () => {
    await reserve(O1, 'C002', 35_000);
    await repository.release(O1);
    await repository.release(O1);
    expect((await reserve(O2, 'C002', 35_000))?.reserved).toBe(true);
  });

  it('does not bring a released order back when its event is delivered again', async () => {
    await reserve(O1, 'C002', 35_000);
    await repository.confirm({ orderId: O1, clientId: 'C002', amountCents: 35_000, now });
    await repository.release(O1);
    await repository.confirm({ orderId: O1, clientId: 'C002', amountCents: 35_000, now });
    expect((await repository.holdsByClient(['C002'], now)).get('C002') ?? 0).toBe(0);
  });

  it('holds again for an order whose first hold was released (a new attempt)', async () => {
    await reserve(O1, 'C002', 35_000);
    await repository.release(O1);
    expect(await reserve(O1, 'C002', 20_000)).toEqual({ reserved: true, availableCents: 15_000 });
  });

  it('answers null for a client that does not exist', async () => {
    expect(await reserve(O1, 'C999', 100)).toBeNull();
  });
});

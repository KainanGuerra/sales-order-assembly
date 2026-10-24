import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

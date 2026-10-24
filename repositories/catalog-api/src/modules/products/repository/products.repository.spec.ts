import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { priceTableItems, products } from '../../../db/schema.js';
import { SeedService } from '../../seed/seed.service.js';
import { ProductsRepository, escapeLike } from './products.repository.js';

// Runs against the Postgres from docker compose, in the separate "catalog_test"
// schema (same owner, same migrations). Skipped when no database is given:
//   TEST_DATABASE_URL=postgres://catalog_role:<password>@127.0.0.1:5432/sales pnpm test
const url = process.env.TEST_DATABASE_URL;
const TEST_SCHEMA = 'catalog_test';
const seedFile = fileURLToPath(new URL('../../../../../../seed.json', import.meta.url));

describe.skipIf(!url)('ProductsRepository (real Postgres)', () => {
  let pool: Pool;
  let db: Database;
  let repository: ProductsRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
    await db.execute(sql`truncate table price_table_items, price_tables, products cascade`);
    await new SeedService(db, { SEED_FILE: seedFile } as Env).onApplicationBootstrap();
    repository = new ProductsRepository(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('loads the delivered seed', async () => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
    expect(count).toBe(23);
  });

  it('is idempotent: seeding twice does not duplicate rows', async () => {
    await new SeedService(db, { SEED_FILE: seedFile } as Env).onApplicationBootstrap();
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(priceTableItems);
    expect(count).toBe(68);
  });

  it('finds a product ignoring accents and case', async () => {
    const rows = await repository.search('ACUCAR', 'TP01', 10);
    expect(rows.map((r) => r.id)).toEqual(['P003']);
    expect(rows[0].unitPriceCents).toBe(479);
  });

  it('uses the price of the requested table', async () => {
    const standard = await repository.search('arroz', 'TP01', 10);
    const volume = await repository.search('arroz', 'TP02', 10);
    expect(standard[0].unitPriceCents).toBe(2690);
    expect(volume[0].unitPriceCents).toBe(2529);
  });

  it('tolerates a typo', async () => {
    expect((await repository.search('feijaum', 'TP01', 10)).map((r) => r.id)).toEqual(['P002']);
  });

  it('returns nothing for an unrelated word', async () => {
    expect(await repository.search('xyzzy', 'TP01', 10)).toEqual([]);
  });

  it('returns both products that share an EAN, ordered by id', async () => {
    const rows = await repository.search('7891831978575', 'TP01', 10);
    expect(rows.map((r) => r.id)).toEqual(['P009', 'P023']);
  });

  it('ranks the exact description before the longer one', async () => {
    const rows = await repository.search('Achocolatado em Pó 400g', 'TP01', 10);
    expect(rows.map((r) => r.id)).toEqual(['P009', 'P023']);
  });

  it('breaks ties between equally good matches by product id', async () => {
    // "biscoito" matches P008 and P022 with the same score.
    const rows = await repository.search('biscoito', 'TP01', 10);
    expect(rows.map((r) => r.id)).toEqual(['P008', 'P022']);
  });

  it('finds an exact SKU regardless of case', async () => {
    expect((await repository.search('sku-1020', 'TP03', 10)).map((r) => r.id)).toEqual(['P021']);
  });

  it('returns a product missing from the table with a null price', async () => {
    const [row] = await repository.search('sku-1020', 'TP03', 10);
    expect(row).toMatchObject({ id: 'P021', active: false, unitPriceCents: null });
  });

  it('returns null prices when no price table is given', async () => {
    const [row] = await repository.search('arroz', null, 10);
    expect(row.unitPriceCents).toBeNull();
  });

  it('treats % and _ in the query as plain characters', async () => {
    expect(await repository.search('%', 'TP01', 10)).toEqual([]);
    expect(await repository.search('_____', 'TP01', 10)).toEqual([]);
  });

  it('looks products up by id with the pack rules', async () => {
    const rows = await repository.findByIds(['P003', 'P004'], 'TP01');
    const sugar = rows.find((r) => r.id === 'P003');
    const oil = rows.find((r) => r.id === 'P004');
    expect(sugar).toMatchObject({ saleUnit: 'FD', packFactor: 10, multipleOnly: true });
    expect(oil).toMatchObject({ saleUnit: 'CX', packFactor: 20, multipleOnly: false });
  });

  it('is happy with an empty id list', async () => {
    expect(await repository.findByIds([], 'TP01')).toEqual([]);
  });
});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

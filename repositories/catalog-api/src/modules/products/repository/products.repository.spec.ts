import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { countedOrders, priceTableItems, productStats, products } from '../../../db/schema.js';
import { SeedService } from '../../seed/seed.service.js';
import { ProductStatsRepository } from './product-stats.repository.js';
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
  let stats: ProductStatsRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
    await db.execute(sql`truncate table price_table_items, price_tables, products, product_stats, counted_orders cascade`);
    await new SeedService(db, { SEED_FILE: seedFile } as Env).onApplicationBootstrap();
    repository = new ProductsRepository(db);
    stats = new ProductStatsRepository(db);
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table product_stats, counted_orders`);
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
  describe('most ordered products', () => {
    const ORDER_A = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';
    const ORDER_B = '9b1d7e52-0c6f-4a52-8f0e-5a3b8f7c2d11';
    const units = async () =>
      Object.fromEntries((await db.select().from(productStats)).map((r) => [r.productId, r.unitsOrdered]));

    it('adds the units of an order to each product', async () => {
      await stats.countOrder(ORDER_A, [
        { productId: 'P001', quantity: 12 },
        { productId: 'P002', quantity: 5 },
      ]);
      expect(await units()).toEqual({ P001: 12, P002: 5 });
    });

    it('adds up the units across orders', async () => {
      await stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }]);
      await stats.countOrder(ORDER_B, [{ productId: 'P001', quantity: 8 }]);
      expect(await units()).toEqual({ P001: 20 });
    });

    it('adds a product that is on two lines of the same order once, summed', async () => {
      await stats.countOrder(ORDER_A, [
        { productId: 'P001', quantity: 12 },
        { productId: 'P001', quantity: 3 },
      ]);
      expect(await units()).toEqual({ P001: 15 });
    });

    it('counts an order only once when its event is delivered again', async () => {
      expect(await stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }])).toBe(true);
      expect(await stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }])).toBe(false);
      expect(await units()).toEqual({ P001: 12 });
    });

    it('loses no units when different orders arrive at the same time', async () => {
      const orderIds = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
      await Promise.all(orderIds.map((id) => stats.countOrder(id, [{ productId: 'P001', quantity: 3 }])));
      expect(await units()).toEqual({ P001: 30 });
    });

    it('counts an order only once when two deliveries arrive at the same time', async () => {
      const results = await Promise.all([
        stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }]),
        stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }]),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await units()).toEqual({ P001: 12 });
    });

    it('leaves the order unmarked when adding the units fails, so the redelivery can count it', async () => {
      // Larger than a Postgres integer: the insert fails after the order was marked.
      await expect(stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 3_000_000_000 }])).rejects.toThrow();
      expect(await db.select().from(countedOrders)).toEqual([]);
      expect(await stats.countOrder(ORDER_A, [{ productId: 'P001', quantity: 12 }])).toBe(true);
    });

    it('accepts a product this catalog does not know', async () => {
      await stats.countOrder(ORDER_A, [{ productId: 'P999', quantity: 1 }]);
      expect(await units()).toEqual({ P999: 1 });
    });

    it('puts the more ordered product first when two matches are equally good', async () => {
      // "biscoito" matches P008 and P022 with the same score (id decides without stats).
      await stats.countOrder(ORDER_A, [{ productId: 'P022', quantity: 30 }]);
      const rows = await repository.search('biscoito', 'TP01', 10);
      expect(rows.map((r) => r.id)).toEqual(['P022', 'P008']);
    });

    it('puts the more ordered of two products sharing an EAN first', async () => {
      await stats.countOrder(ORDER_A, [{ productId: 'P023', quantity: 30 }]);
      const rows = await repository.search('7891831978575', 'TP01', 10);
      expect(rows.map((r) => r.id)).toEqual(['P023', 'P009']);
    });

    it('never lets popularity beat a better match', async () => {
      // P023 sells far more, but P009 is the exact description.
      await stats.countOrder(ORDER_A, [{ productId: 'P023', quantity: 500 }]);
      const rows = await repository.search('Achocolatado em Pó 400g', 'TP01', 10);
      expect(rows.map((r) => r.id)).toEqual(['P009', 'P023']);
    });
  });

});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

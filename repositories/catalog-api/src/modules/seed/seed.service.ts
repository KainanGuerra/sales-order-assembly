import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/database.module.js';
import { priceTableItems, priceTables, products } from '../../db/schema.js';
import { mapCatalogSeed } from './seed-mapper.js';

// Loads the catalog's slice of seed.json at startup. Idempotent: running it
// again updates the same rows instead of duplicating them.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onApplicationBootstrap() {
    if (!existsSync(this.env.SEED_FILE)) {
      this.logger.warn(`Seed file not found at ${this.env.SEED_FILE}; skipping the import`);
      return;
    }
    const seed = mapCatalogSeed(JSON.parse(readFileSync(this.env.SEED_FILE, 'utf8')));

    await this.db.transaction(async (tx) => {
      await tx
        .insert(products)
        .values(seed.products)
        .onConflictDoUpdate({
          target: products.id,
          set: {
            sku: sql`excluded.sku`,
            ean: sql`excluded.ean`,
            description: sql`excluded.description`,
            category: sql`excluded.category`,
            brand: sql`excluded.brand`,
            saleUnit: sql`excluded.sale_unit`,
            packFactor: sql`excluded.pack_factor`,
            multipleOnly: sql`excluded.multiple_only`,
            active: sql`excluded.active`,
          },
        });
      await tx
        .insert(priceTables)
        .values(seed.priceTables)
        .onConflictDoUpdate({ target: priceTables.id, set: { name: sql`excluded.name` } });
      await tx
        .insert(priceTableItems)
        .values(seed.priceItems)
        .onConflictDoUpdate({
          target: [priceTableItems.priceTableId, priceTableItems.productId],
          set: { unitPriceCents: sql`excluded.unit_price_cents` },
        });
    });

    this.logger.log(
      `Seed loaded: ${seed.products.length} products, ${seed.priceTables.length} price tables, ${seed.priceItems.length} prices`,
    );
  }
}

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/database.module.js';
import { clients, sellers, supervisors } from '../../db/schema.js';
import { mapIdentitySeed } from './seed-mapper.js';

// Loads identity's slice of seed.json at startup. Idempotent: running it again
// updates the same rows. credit_used_cents is NOT overwritten on a re-run, so a
// restart never erases credit consumed by orders created after the first load.
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
    const seed = mapIdentitySeed(JSON.parse(readFileSync(this.env.SEED_FILE, 'utf8')));

    await this.db.transaction(async (tx) => {
      await tx
        .insert(supervisors)
        .values(seed.supervisors)
        .onConflictDoUpdate({ target: supervisors.id, set: { name: sql`excluded.name` } });
      await tx
        .insert(sellers)
        .values(seed.sellers)
        .onConflictDoUpdate({
          target: sellers.id,
          set: {
            name: sql`excluded.name`,
            supervisorId: sql`excluded.supervisor_id`,
            discountLimitBp: sql`excluded.discount_limit_bp`,
          },
        });
      await tx
        .insert(clients)
        .values(seed.clients)
        .onConflictDoUpdate({
          target: clients.id,
          set: {
            tradeName: sql`excluded.trade_name`,
            legalName: sql`excluded.legal_name`,
            cnpj: sql`excluded.cnpj`,
            sellerId: sql`excluded.seller_id`,
            priceTableId: sql`excluded.price_table_id`,
            creditLimitCents: sql`excluded.credit_limit_cents`,
            city: sql`excluded.city`,
            state: sql`excluded.state`,
          },
        });
    });

    this.logger.log(
      `Seed loaded: ${seed.supervisors.length} supervisors, ${seed.sellers.length} sellers, ${seed.clients.length} clients`,
    );
  }
}

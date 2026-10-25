import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { ENV, type Env } from '../../config/env.js';
import { OrdersRepository } from '../orders/repository/orders.repository.js';
import { mapHistoryOrders } from './seed-mapper.js';

// Brings in the history orders of the orders seed (seed/seed.json) at startup. Idempotent: an order
// that is already there is left as it is. Imported orders take no credit (the
// client's "already used" amount in the seed counts them) and have no
// reservation.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly repository: OrdersRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onApplicationBootstrap() {
    if (!existsSync(this.env.SEED_FILE)) {
      this.logger.warn(`Seed file not found at ${this.env.SEED_FILE}; skipping the import`);
      return;
    }
    const imported = mapHistoryOrders(JSON.parse(readFileSync(this.env.SEED_FILE, 'utf8')), this.env.DEFAULT_PRICE_TABLE_ID);

    let added = 0;
    for (const { order, items, history } of imported) {
      if (await this.repository.insertImported(order, items, { status: history.status, actor: history.actor, createdAt: history.createdAt })) {
        added += 1;
      }
    }
    this.logger.log(`Seed history: ${imported.length} orders in the file, ${added} imported now`);
  }
}

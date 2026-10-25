import { Injectable } from '@nestjs/common';
import type { OrderSubmittedEvent } from 'contracts';
import { ProductStatsRepository } from '../repository/product-stats.repository.js';

@Injectable()
export class ProductStatsService {
  constructor(private readonly stats: ProductStatsRepository) {}

  // Counts the units of an order that reached SUBMITTED, whether it was sent
  // straight away or after a supervisor approved it. Idempotent by order id.
  async onSubmitted(event: OrderSubmittedEvent): Promise<void> {
    await this.stats.countOrder(event.orderId, event.items);
  }
}

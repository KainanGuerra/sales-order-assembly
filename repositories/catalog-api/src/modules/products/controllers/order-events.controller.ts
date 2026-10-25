import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, type RmqContext } from '@nestjs/microservices';
import { ORDER_EVENT_PATTERNS, OrderSubmittedEventSchema } from 'contracts';
import { consume } from '../../../shared/messaging/consume.js';
import { ProductStatsService } from '../services/product-stats.service.js';

// Catalog only listens to one event: an order that was submitted.
@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  constructor(private readonly service: ProductStatsService) {}

  @EventPattern(ORDER_EVENT_PATTERNS.submitted)
  onSubmitted(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderSubmittedEventSchema, payload, (e) => this.service.onSubmitted(e), this.logger);
  }
}

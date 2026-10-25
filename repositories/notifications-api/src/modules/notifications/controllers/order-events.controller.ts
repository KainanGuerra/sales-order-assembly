import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, type RmqContext } from '@nestjs/microservices';
import {
  ORDER_EVENT_PATTERNS,
  OrderApprovedEventSchema,
  OrderPlacedEventSchema,
  OrderRejectedEventSchema,
  OrderSubmittedEventSchema,
} from 'contracts';
import { consume } from '../../../shared/messaging/consume.js';
import { NotificationsService } from '../services/notifications.service.js';

// Every order event is somebody's news. What each one means is in domain/plan.ts.
@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  constructor(private readonly service: NotificationsService) {}

  @EventPattern(ORDER_EVENT_PATTERNS.placed)
  onPlaced(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderPlacedEventSchema, payload, (e) => this.service.onPlaced(e), this.logger);
  }

  @EventPattern(ORDER_EVENT_PATTERNS.submitted)
  onSubmitted(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderSubmittedEventSchema, payload, (e) => this.service.onSubmitted(e), this.logger);
  }

  @EventPattern(ORDER_EVENT_PATTERNS.approved)
  onApproved(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderApprovedEventSchema, payload, (e) => this.service.onApproved(e), this.logger);
  }

  @EventPattern(ORDER_EVENT_PATTERNS.rejected)
  onRejected(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderRejectedEventSchema, payload, (e) => this.service.onRejected(e), this.logger);
  }
}

import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, type RmqContext } from '@nestjs/microservices';
import {
  ORDER_EVENT_PATTERNS,
  OrderRejectedEventSchema,
  OrderSubmittedEventSchema,
} from 'contracts';
import { consume } from '../../../shared/messaging/consume.js';
import { PeopleService } from '../services/people.service.js';

// The events of orders that identity cares about, both about credit.
@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  constructor(private readonly service: PeopleService) {}

  @EventPattern(ORDER_EVENT_PATTERNS.submitted)
  onSubmitted(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderSubmittedEventSchema, payload, (event) => this.service.confirmSubmitted(event), this.logger);
  }

  @EventPattern(ORDER_EVENT_PATTERNS.rejected)
  onRejected(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderRejectedEventSchema, payload, (event) => this.service.releaseRejected(event), this.logger);
  }
}

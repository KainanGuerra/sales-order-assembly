import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, type RmqContext } from '@nestjs/microservices';
import {
  ORDER_EVENT_PATTERNS,
  OrderRejectedEventSchema,
  OrderPlacedEventSchema,
} from 'contracts';
import { consume } from '../../../shared/messaging/consume.js';
import { PeopleService } from '../services/people.service.js';

// The events of orders that identity cares about, both about credit: a placed
// order keeps its hold for good, a rejected one gives it back.
@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  constructor(private readonly service: PeopleService) {}

  @EventPattern(ORDER_EVENT_PATTERNS.placed)
  onPlaced(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderPlacedEventSchema, payload, (event) => this.service.confirmPlaced(event), this.logger);
  }

  @EventPattern(ORDER_EVENT_PATTERNS.rejected)
  onRejected(@Payload() payload: unknown, @Ctx() context: unknown) {
    return consume(context as RmqContext, OrderRejectedEventSchema, payload, (event) => this.service.releaseRejected(event), this.logger);
  }
}

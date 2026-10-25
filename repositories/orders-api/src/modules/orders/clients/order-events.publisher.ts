import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ORDER_EVENT_PATTERNS, type OrderSubmittedEvent } from 'contracts';
import { lastValueFrom } from 'rxjs';

export const RABBITMQ_CLIENT = Symbol('RABBITMQ_CLIENT');

// What the order needs from the broker; tests replace it with a fake.
export interface OrderEventsPublisher {
  publishSubmitted(event: OrderSubmittedEvent): Promise<void>;
}
export const ORDER_EVENTS_PUBLISHER = Symbol('ORDER_EVENTS_PUBLISHER');

@Injectable()
export class RabbitOrderEventsPublisher implements OrderEventsPublisher {
  private readonly logger = new Logger(RabbitOrderEventsPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  // Published after the order is saved. A broker failure is logged and does not
  // undo the order: without an outbox the event can be lost (see DECISIONS.md).
  async publishSubmitted(event: OrderSubmittedEvent): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(ORDER_EVENT_PATTERNS.submitted, event));
    } catch (error) {
      this.logger.error(`Could not publish ${ORDER_EVENT_PATTERNS.submitted} for order ${event.orderId}`, error as Error);
    }
  }
}

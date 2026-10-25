import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  ORDER_EVENT_PATTERNS,
  type OrderApprovedEvent,
  type OrderPlacedEvent,
  type OrderRejectedEvent,
  type OrderSubmittedEvent,
} from 'contracts';
import { lastValueFrom } from 'rxjs';

export const RABBITMQ_CLIENT = Symbol('RABBITMQ_CLIENT');

// What the order needs from the broker; tests replace it with a fake.
export interface OrderEventsPublisher {
  publishPlaced(event: OrderPlacedEvent): Promise<void>;
  publishSubmitted(event: OrderSubmittedEvent): Promise<void>;
  publishApproved(event: OrderApprovedEvent): Promise<void>;
  publishRejected(event: OrderRejectedEvent): Promise<void>;
}
export const ORDER_EVENTS_PUBLISHER = Symbol('ORDER_EVENTS_PUBLISHER');

@Injectable()
export class RabbitOrderEventsPublisher implements OrderEventsPublisher {
  private readonly logger = new Logger(RabbitOrderEventsPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  publishPlaced(event: OrderPlacedEvent) {
    return this.emit(ORDER_EVENT_PATTERNS.placed, event.orderId, event);
  }

  publishSubmitted(event: OrderSubmittedEvent) {
    return this.emit(ORDER_EVENT_PATTERNS.submitted, event.orderId, event);
  }

  publishApproved(event: OrderApprovedEvent) {
    return this.emit(ORDER_EVENT_PATTERNS.approved, event.orderId, event);
  }

  publishRejected(event: OrderRejectedEvent) {
    return this.emit(ORDER_EVENT_PATTERNS.rejected, event.orderId, event);
  }

  // Published after the change is saved. A broker failure is logged and does not
  // undo it: without an outbox the event can be lost (see DECISIONS.md).
  private async emit(pattern: string, orderId: string, payload: unknown): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(pattern, payload));
    } catch (error) {
      this.logger.error(`Could not publish ${pattern} for order ${orderId}`, error as Error);
    }
  }
}

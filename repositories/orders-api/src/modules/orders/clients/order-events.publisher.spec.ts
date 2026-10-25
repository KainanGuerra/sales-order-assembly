import type { ClientProxy } from '@nestjs/microservices';
import type { OrderSubmittedEvent } from 'contracts';
import { throwError, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RabbitOrderEventsPublisher } from './order-events.publisher.js';

const event: OrderSubmittedEvent = {
  orderId: '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10',
  clientId: 'C001',
  sellerId: 'V01',
  supervisorId: 'S01',
  status: 'SUBMITTED',
  totalCents: 50_000,
  items: [{ productId: 'P1', quantity: 5 }],
  submittedAt: '2026-10-24T12:00:00.000Z',
};

describe('RabbitOrderEventsPublisher', () => {
  it('emits the event under the order.submitted pattern', async () => {
    const emit = vi.fn(() => of(undefined));
    await new RabbitOrderEventsPublisher({ emit } as unknown as ClientProxy).publishSubmitted(event);
    expect(emit).toHaveBeenCalledWith('order.submitted', event);
  });

  it('does not throw when the broker is down: the order is already saved', async () => {
    const emit = vi.fn(() => throwError(() => new Error('connection refused')));
    const publisher = new RabbitOrderEventsPublisher({ emit } as unknown as ClientProxy);
    await expect(publisher.publishSubmitted(event)).resolves.toBeUndefined();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});

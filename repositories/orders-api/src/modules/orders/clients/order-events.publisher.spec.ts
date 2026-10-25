import type { ClientProxy } from '@nestjs/microservices';
import { throwError, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RabbitOrderEventsPublisher } from './order-events.publisher.js';

const orderId = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';
const items = [{ productId: 'P1', quantity: 5 }];

const events = {
  placed: { orderId, clientId: 'C001', sellerId: 'V01', supervisorId: 'S01', status: 'SUBMITTED' as const, totalCents: 50_000, items, placedAt: '2026-10-24T12:00:00.000Z' },
  submitted: { orderId, clientId: 'C001', sellerId: 'V01', totalCents: 50_000, items, submittedAt: '2026-10-24T12:00:00.000Z' },
  approved: { orderId, approvedBy: 'S01', approvedAt: '2026-10-24T12:05:00.000Z' },
  rejected: { orderId, rejectedBy: 'S01', reasonCode: 'CREDIT_RISK' as const, rejectedAt: '2026-10-24T12:05:00.000Z' },
};

describe('RabbitOrderEventsPublisher', () => {
  it('emits each event under its own pattern', async () => {
    const emit = vi.fn(() => of(undefined));
    const publisher = new RabbitOrderEventsPublisher({ emit } as unknown as ClientProxy);
    await publisher.publishPlaced(events.placed);
    await publisher.publishSubmitted(events.submitted);
    await publisher.publishApproved(events.approved);
    await publisher.publishRejected(events.rejected);
    expect(emit.mock.calls).toEqual([
      ['order.placed', events.placed],
      ['order.submitted', events.submitted],
      ['order.approved', events.approved],
      ['order.rejected', events.rejected],
    ]);
  });

  it('does not throw when the broker is down: the change is already saved', async () => {
    const emit = vi.fn(() => throwError(() => new Error('connection refused')));
    const publisher = new RabbitOrderEventsPublisher({ emit } as unknown as ClientProxy);
    await expect(publisher.publishPlaced(events.placed)).resolves.toBeUndefined();
    await expect(publisher.publishRejected(events.rejected)).resolves.toBeUndefined();
    expect(emit).toHaveBeenCalledTimes(2);
  });
});

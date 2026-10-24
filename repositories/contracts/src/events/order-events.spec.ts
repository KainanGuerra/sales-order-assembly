import { describe, expect, it } from 'vitest';
import {
  OrderApprovedEventSchema,
  OrderRejectedEventSchema,
  OrderSubmittedEventSchema,
} from './order-events.js';

const validSubmitted = {
  orderId: '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10',
  clientId: 'C001',
  sellerId: 'V01',
  supervisorId: 'S01',
  status: 'SUBMITTED',
  totalCents: 23722,
  items: [{ productId: 'P001', quantity: 10 }],
  submittedAt: '2026-10-24T12:00:00.000Z',
};

describe('order events', () => {
  it('accepts a valid OrderSubmitted payload', () => {
    expect(OrderSubmittedEventSchema.safeParse(validSubmitted).success).toBe(true);
  });

  it('rejects an OrderSubmitted payload with fractional cents', () => {
    const result = OrderSubmittedEventSchema.safeParse({ ...validSubmitted, totalCents: 10.5 });
    expect(result.success).toBe(false);
  });

  it('rejects an OrderSubmitted payload without items', () => {
    const result = OrderSubmittedEventSchema.safeParse({ ...validSubmitted, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status', () => {
    const result = OrderSubmittedEventSchema.safeParse({ ...validSubmitted, status: 'Enviado' });
    expect(result.success).toBe(false);
  });

  it('accepts approved and rejected payloads', () => {
    const base = { orderId: validSubmitted.orderId };
    expect(
      OrderApprovedEventSchema.safeParse({
        ...base,
        approvedBy: 'S01',
        approvedAt: '2026-10-24T12:05:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      OrderRejectedEventSchema.safeParse({
        ...base,
        rejectedBy: 'S01',
        rejectedAt: '2026-10-24T12:05:00.000Z',
      }).success,
    ).toBe(true);
  });
});

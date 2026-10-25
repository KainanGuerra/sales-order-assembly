import { describe, expect, it } from 'vitest';
import {
  OrderApprovedEventSchema,
  OrderPlacedEventSchema,
  OrderRejectedEventSchema,
  OrderSubmittedEventSchema,
  REJECTION_REASON_CODES,
} from './order-events.js';

const orderId = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';
const items = [{ productId: 'P001', quantity: 10 }];

const placed = {
  orderId,
  clientId: 'C001',
  sellerId: 'V01',
  supervisorId: 'S01',
  status: 'AWAITING_APPROVAL',
  totalCents: 23722,
  items,
  placedAt: '2026-10-24T12:00:00.000Z',
};

describe('OrderPlaced', () => {
  it('accepts an order within the limit and one awaiting approval', () => {
    expect(OrderPlacedEventSchema.safeParse(placed).success).toBe(true);
    expect(OrderPlacedEventSchema.safeParse({ ...placed, status: 'SUBMITTED' }).success).toBe(true);
  });

  it('refuses a status an order cannot have when it is created', () => {
    expect(OrderPlacedEventSchema.safeParse({ ...placed, status: 'REJECTED' }).success).toBe(false);
    expect(OrderPlacedEventSchema.safeParse({ ...placed, status: 'Enviado' }).success).toBe(false);
  });

  it('refuses fractional cents and an order without items', () => {
    expect(OrderPlacedEventSchema.safeParse({ ...placed, totalCents: 10.5 }).success).toBe(false);
    expect(OrderPlacedEventSchema.safeParse({ ...placed, items: [] }).success).toBe(false);
  });
});

describe('OrderSubmitted', () => {
  const submitted = { orderId, clientId: 'C001', sellerId: 'V01', totalCents: 23722, items, submittedAt: '2026-10-24T12:00:00.000Z' };

  it('accepts a valid payload', () => {
    expect(OrderSubmittedEventSchema.safeParse(submitted).success).toBe(true);
  });

  it('refuses a payload without a client', () => {
    expect(OrderSubmittedEventSchema.safeParse({ ...submitted, clientId: '' }).success).toBe(false);
  });
});

describe('OrderApproved', () => {
  it('accepts approver and time', () => {
    expect(OrderApprovedEventSchema.safeParse({ orderId, approvedBy: 'S01', approvedAt: '2026-10-24T12:05:00.000Z' }).success).toBe(true);
  });

  it('refuses a missing approver', () => {
    expect(OrderApprovedEventSchema.safeParse({ orderId, approvedAt: '2026-10-24T12:05:00.000Z' }).success).toBe(false);
  });
});

describe('OrderRejected', () => {
  const base = { orderId, rejectedBy: 'S01', rejectedAt: '2026-10-24T12:05:00.000Z' };

  it.each(REJECTION_REASON_CODES)('accepts the reason code %s', (reasonCode) => {
    expect(OrderRejectedEventSchema.safeParse({ ...base, reasonCode }).success).toBe(true);
  });

  it('carries the free text of OTHER', () => {
    const parsed = OrderRejectedEventSchema.parse({ ...base, reasonCode: 'OTHER', reasonText: 'Cliente pediu para cancelar' });
    expect(parsed.reasonText).toBe('Cliente pediu para cancelar');
  });

  it('refuses a rejection with no reason code or an unknown one', () => {
    expect(OrderRejectedEventSchema.safeParse(base).success).toBe(false);
    expect(OrderRejectedEventSchema.safeParse({ ...base, reasonCode: 'BECAUSE' }).success).toBe(false);
  });
});

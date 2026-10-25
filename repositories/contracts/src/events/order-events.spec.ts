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
// What every event says about whom the order is about.
const ref = { orderId, sellerId: 'V01', supervisorId: 'S01', clientId: 'C001', clientTradeName: 'Mercadinho São José', totalCents: 23722 };

const placed = { ...ref, status: 'AWAITING_APPROVAL', items, placedAt: '2026-10-24T12:00:00.000Z' };

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
  const submitted = { ...ref, items, submittedAt: '2026-10-24T12:00:00.000Z' };

  it('accepts a valid payload', () => {
    expect(OrderSubmittedEventSchema.safeParse(submitted).success).toBe(true);
  });

  it('refuses a payload without a client', () => {
    expect(OrderSubmittedEventSchema.safeParse({ ...submitted, clientId: '' }).success).toBe(false);
  });
});

describe('OrderApproved', () => {
  it('accepts approver and time', () => {
    expect(OrderApprovedEventSchema.safeParse({ ...ref, approvedBy: 'S01', approvedAt: '2026-10-24T12:05:00.000Z' }).success).toBe(true);
  });

  it('refuses a missing approver', () => {
    expect(OrderApprovedEventSchema.safeParse({ ...ref, approvedAt: '2026-10-24T12:05:00.000Z' }).success).toBe(false);
  });
});

describe('OrderRejected', () => {
  const base = { ...ref, rejectedBy: 'S01', rejectedAt: '2026-10-24T12:05:00.000Z' };

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

describe('who the order is about', () => {
  it.each([
    ['placed', OrderPlacedEventSchema, placed],
    ['submitted', OrderSubmittedEventSchema, { ...ref, items, submittedAt: '2026-10-24T12:00:00.000Z' }],
    ['approved', OrderApprovedEventSchema, { ...ref, approvedBy: 'S01', approvedAt: '2026-10-24T12:05:00.000Z' }],
    ['rejected', OrderRejectedEventSchema, { ...ref, rejectedBy: 'S01', reasonCode: 'CREDIT_RISK', rejectedAt: '2026-10-24T12:05:00.000Z' }],
  ] as const)('is required on every %s event, so a consumer never has to call another service', (_name, schema, valid) => {
    expect(schema.safeParse(valid).success).toBe(true);
    for (const field of ['sellerId', 'supervisorId', 'clientId', 'clientTradeName', 'totalCents'] as const) {
      const { [field]: _removed, ...without } = valid as Record<string, unknown>;
      expect(schema.safeParse(without).success, `without ${field}`).toBe(false);
    }
  });
});

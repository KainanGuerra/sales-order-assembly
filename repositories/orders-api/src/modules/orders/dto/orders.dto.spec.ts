import { describe, expect, it } from 'vitest';
import { ListOrdersQuerySchema, OrderIdSchema, RejectOrderSchema } from './orders.dto.js';

describe('RejectOrderSchema', () => {
  it.each(['DISCOUNT_TOO_HIGH', 'CREDIT_RISK', 'PRODUCT_OR_QUANTITY', 'ORDER_DATA_WRONG'])('accepts the listed reason %s with no text', (reasonCode) => {
    expect(RejectOrderSchema.safeParse({ reasonCode }).success).toBe(true);
  });

  it('requires a text for OTHER', () => {
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER' }).success).toBe(false);
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: '  ' }).success).toBe(false);
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: 'ab' }).success).toBe(false);
  });

  it('accepts OTHER with a text of three characters or more', () => {
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: 'abc' }).success).toBe(true);
  });

  it('refuses a reason that is not in the list, and an enormous text', () => {
    expect(RejectOrderSchema.safeParse({ reasonCode: 'BECAUSE' }).success).toBe(false);
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('OrderIdSchema', () => {
  it('accepts a UUID and refuses anything else', () => {
    expect(OrderIdSchema.safeParse('3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10').success).toBe(true);
    expect(OrderIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(OrderIdSchema.safeParse('pending-approval').success).toBe(false);
  });
});

describe('ListOrdersQuerySchema', () => {
  it('needs a client, and defaults to the latest 10', () => {
    expect(ListOrdersQuerySchema.safeParse({}).success).toBe(false);
    expect(ListOrdersQuerySchema.parse({ clientId: 'C001' })).toEqual({ clientId: 'C001', limit: 10 });
  });

  it('reads the limit from the query string and keeps it between 1 and 50', () => {
    expect(ListOrdersQuerySchema.parse({ clientId: 'C001', limit: '25' }).limit).toBe(25);
    expect(ListOrdersQuerySchema.safeParse({ clientId: 'C001', limit: '0' }).success).toBe(false);
    expect(ListOrdersQuerySchema.safeParse({ clientId: 'C001', limit: '51' }).success).toBe(false);
  });
});

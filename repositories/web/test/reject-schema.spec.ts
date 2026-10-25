import { describe, expect, it } from 'vitest';
import { REJECTION_REASON_CODES, RejectOrderSchema } from '../server/utils/order-schemas';
import { formatDateTime, parseActor } from '../app/utils/format';

describe('RejectOrderSchema', () => {
  it.each(REJECTION_REASON_CODES.filter((c) => c !== 'OTHER'))('accepts the listed reason %s with no text', (reasonCode) => {
    expect(RejectOrderSchema.safeParse({ reasonCode }).success).toBe(true);
  });

  it('needs a text of at least three characters for OTHER', () => {
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER' }).success).toBe(false);
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: ' a ' }).success).toBe(false);
    expect(RejectOrderSchema.safeParse({ reasonCode: 'OTHER', reasonText: 'abc' }).success).toBe(true);
  });

  it('refuses a reason that is not in the list', () => {
    expect(RejectOrderSchema.safeParse({ reasonCode: 'BECAUSE' }).success).toBe(false);
  });
});

describe('parseActor', () => {
  it('splits a person from the system', () => {
    expect(parseActor('user:S01')).toEqual({ kind: 'user', name: 'S01' });
    expect(parseActor('system:orders')).toEqual({ kind: 'system', name: 'orders' });
  });
});

describe('formatDateTime', () => {
  it('writes day first, in the given time zone', () => {
    expect(formatDateTime('2026-10-24T15:05:00.000Z', 'America/Sao_Paulo').replace(/\s/g, ' ')).toBe('24/10/2026, 12:05');
  });
});

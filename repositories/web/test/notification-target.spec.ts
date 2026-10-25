import { describe, expect, it } from 'vitest';
import { notificationTarget } from '~/utils/notification-target';

describe('notificationTarget', () => {
  it('sends the supervisor to the analysis screen', () => {
    expect(notificationTarget({ orderId: 'abc' }, 'SUPERVISOR')).toBe('/approvals/abc');
  });

  it("sends the seller to their order", () => {
    expect(notificationTarget({ orderId: 'abc' }, 'SELLER')).toBe('/orders/abc');
  });
});

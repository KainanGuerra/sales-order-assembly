import { describe, expect, it } from 'vitest';
import { isActive, navFor } from '~/utils/navigation';

describe('navFor', () => {
  it('shows the seller the client list and not the approvals', () => {
    const keys = navFor('SELLER').map((item) => item.key);
    expect(keys).toContain('clients');
    expect(keys).not.toContain('approvals');
  });

  it('shows the supervisor the approvals and not the client list', () => {
    const keys = navFor('SUPERVISOR').map((item) => item.key);
    expect(keys).toContain('approvals');
    expect(keys).not.toContain('clients');
  });

  it('shows both roles the notifications', () => {
    expect(navFor('SELLER').map((i) => i.key)).toContain('notifications');
    expect(navFor('SUPERVISOR').map((i) => i.key)).toContain('notifications');
  });
});

describe('isActive', () => {
  it('lights the entry for its own page and the pages under it', () => {
    expect(isActive({ to: '/clients' }, '/clients')).toBe(true);
    expect(isActive({ to: '/clients' }, '/clients/C001/orders')).toBe(true);
  });

  it('does not light an entry whose address only starts the same way', () => {
    expect(isActive({ to: '/orders' }, '/orders-old')).toBe(false);
  });

  it("lights the approvals entry on an order's analysis page", () => {
    expect(isActive({ to: '/supervisor', also: ['/approvals'] }, '/approvals/abc')).toBe(true);
  });
});

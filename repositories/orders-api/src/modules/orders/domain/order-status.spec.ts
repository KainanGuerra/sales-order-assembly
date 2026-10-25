import { describe, expect, it } from 'vitest';
import { decideApprove, decideReject } from './order-status.js';

describe('decideApprove', () => {
  it('applies to an order awaiting approval: approved, then submitted', () => {
    expect(decideApprove('AWAITING_APPROVAL', false)).toEqual({ kind: 'apply', steps: ['APPROVED', 'SUBMITTED'] });
  });

  it('treats a second approval of an approved order as a repeat', () => {
    expect(decideApprove('SUBMITTED', true)).toEqual({ kind: 'already' });
  });

  it('refuses to approve an order that never needed approval', () => {
    expect(decideApprove('SUBMITTED', false)).toEqual({ kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' });
  });

  it('refuses to approve a rejected order', () => {
    expect(decideApprove('REJECTED', false)).toEqual({ kind: 'refused', reason: 'ALREADY_REJECTED' });
  });
});

describe('decideReject', () => {
  it('applies to an order awaiting approval', () => {
    expect(decideReject('AWAITING_APPROVAL')).toEqual({ kind: 'apply', steps: ['REJECTED'] });
  });

  it('treats a second rejection as a repeat', () => {
    expect(decideReject('REJECTED')).toEqual({ kind: 'already' });
  });

  it('refuses to reject an order that was already sent', () => {
    expect(decideReject('SUBMITTED')).toEqual({ kind: 'refused', reason: 'ALREADY_SUBMITTED' });
  });
});

import { describe, expect, it } from 'vitest';
import { decideApprove, decideReject } from './order-status.js';

describe('decideApprove', () => {
  it('applies to an order awaiting approval: approved, then submitted', () => {
    expect(decideApprove('AWAITING_APPROVAL', false)).toEqual({ kind: 'apply', steps: ['APPROVED', 'SUBMITTED'] });
  });

  it.each(['APPROVED', 'SUBMITTED', 'INVOICED'] as const)('treats approving an approved order (now %s) as a repeat', (status) => {
    expect(decideApprove(status, true)).toEqual({ kind: 'already' });
  });

  it.each(['SUBMITTED', 'INVOICED'] as const)('refuses to approve an order that never needed approval (%s)', (status) => {
    expect(decideApprove(status, false)).toEqual({ kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' });
  });

  it('refuses to approve a rejected or cancelled order, naming what happened to it', () => {
    expect(decideApprove('REJECTED', false)).toEqual({ kind: 'refused', reason: 'ALREADY_REJECTED' });
    expect(decideApprove('CANCELLED', false)).toEqual({ kind: 'refused', reason: 'ALREADY_REJECTED' });
  });
});

describe('decideReject', () => {
  it('applies to an order awaiting approval: rejected, then cancelled', () => {
    expect(decideReject('AWAITING_APPROVAL', false)).toEqual({ kind: 'apply', steps: ['REJECTED', 'CANCELLED'] });
  });

  it('treats rejecting a rejected order as a repeat, whether it rests at REJECTED or CANCELLED', () => {
    expect(decideReject('REJECTED', true)).toEqual({ kind: 'already' });
    expect(decideReject('CANCELLED', true)).toEqual({ kind: 'already' });
  });

  it('refuses to reject an order that was cancelled some other way', () => {
    expect(decideReject('CANCELLED', false)).toEqual({ kind: 'refused', reason: 'NOT_AWAITING_APPROVAL' });
  });

  it.each(['APPROVED', 'SUBMITTED', 'INVOICED'] as const)('refuses to reject an order already sent (%s)', (status) => {
    expect(decideReject(status, false)).toEqual({ kind: 'refused', reason: 'ALREADY_SUBMITTED' });
  });
});

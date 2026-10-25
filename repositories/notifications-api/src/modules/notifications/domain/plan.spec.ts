import { describe, expect, it } from 'vitest';
import { planApproved, planPlaced, planRejected, planSubmitted } from './plan.js';

const ref = {
  orderId: '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10',
  sellerId: 'V01',
  supervisorId: 'S01',
  clientId: 'C001',
  clientTradeName: 'Mercadinho São José',
  totalCents: 30_343,
};
const items = [{ productId: 'P001', quantity: 12 }];
const who = (plan: { create: { recipientId: string; kind: string }[] }) => plan.create.map((n) => `${n.recipientId}:${n.kind}`);

describe('planPlaced', () => {
  it('asks the supervisor for a decision and tells the seller it waits, when approval is needed', () => {
    const plan = planPlaced({ ...ref, status: 'AWAITING_APPROVAL', items, placedAt: '2026-10-24T12:00:00.000Z' });
    expect(who(plan)).toEqual(['S01:APPROVAL_NEEDED', 'V01:ORDER_AWAITING_APPROVAL']);
    expect(plan.create[0]).toMatchObject({ recipientRole: 'SUPERVISOR', orderId: ref.orderId, data: { clientTradeName: 'Mercadinho São José', totalCents: 30_343 } });
    expect(plan.resolveOrderId).toBeNull();
  });

  it('tells nobody about an order within the limit: submitted follows, and says it', () => {
    expect(planPlaced({ ...ref, status: 'SUBMITTED', items, placedAt: '2026-10-24T12:00:00.000Z' })).toEqual({ create: [], resolveOrderId: null });
  });
});

describe('planSubmitted', () => {
  it('tells the seller and informs the supervisor', () => {
    const plan = planSubmitted({ ...ref, items, submittedAt: '2026-10-24T12:00:00.000Z' });
    expect(who(plan)).toEqual(['V01:ORDER_SENT', 'S01:ORDER_SENT']);
    expect(plan.create.map((n) => n.recipientRole)).toEqual(['SELLER', 'SUPERVISOR']);
  });

  it('does not close anything', () => {
    expect(planSubmitted({ ...ref, items, submittedAt: '2026-10-24T12:00:00.000Z' }).resolveOrderId).toBeNull();
  });
});

describe('planApproved', () => {
  it('tells the seller who approved, and closes the notices that asked for a decision', () => {
    const plan = planApproved({ ...ref, approvedBy: 'S01', approvedAt: '2026-10-24T12:05:00.000Z' });
    expect(who(plan)).toEqual(['V01:ORDER_APPROVED']);
    expect(plan.create[0].data).toMatchObject({ decidedBy: 'S01' });
    expect(plan.resolveOrderId).toBe(ref.orderId);
  });
});

describe('planRejected', () => {
  it('tells the seller the order was cancelled, with the reason, and closes the pending notices', () => {
    const plan = planRejected({ ...ref, rejectedBy: 'S01', reasonCode: 'OTHER', reasonText: 'Cliente desistiu', rejectedAt: '2026-10-24T12:05:00.000Z' });
    expect(who(plan)).toEqual(['V01:ORDER_CANCELLED']);
    expect(plan.create[0].data).toEqual({ clientTradeName: 'Mercadinho São José', totalCents: 30_343, decidedBy: 'S01', reasonCode: 'OTHER', reasonText: 'Cliente desistiu' });
    expect(plan.resolveOrderId).toBe(ref.orderId);
  });

  it('leaves the free text out when the reason is one from the list', () => {
    const plan = planRejected({ ...ref, rejectedBy: 'S01', reasonCode: 'CREDIT_RISK', rejectedAt: '2026-10-24T12:05:00.000Z' });
    expect(plan.create[0].data).not.toHaveProperty('reasonText');
  });
});

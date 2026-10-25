import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { OrderApprovedEvent, OrderPlacedEvent, OrderRejectedEvent, OrderSubmittedEvent } from 'contracts';
import type { ProductQuote } from 'contracts/catalog';
import type { Client, Seller } from 'contracts/identity';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { Actor } from '../../../shared/actor.js';
import type { CatalogGateway } from '../clients/catalog.client.js';
import type { IdentityGateway } from '../clients/identity.client.js';
import type { OrderEventsPublisher } from '../clients/order-events.publisher.js';
import type { CalculateOrderDto, SubmitOrderDto } from '../dto/orders.dto.js';
import type { NewHistory, NewOrder, NewOrderItem, OrderWithItems } from '../repository/orders.repository.js';
import { OrdersRepository } from '../repository/orders.repository.js';
import { OrdersService } from './orders.service.js';

const env = { MIN_ORDER_CENTS: 30_000, MAX_DISCOUNT_BP: 1_000 } as Env;
const seller: Actor = { role: 'SELLER', id: 'V01' };
const supervisor: Actor = { role: 'SUPERVISOR', id: 'S01' };
const ORDER_ID = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';
const T0 = new Date('2026-10-24T12:00:00Z');

const v01: Seller = { id: 'V01', name: 'Carlos Menezes', supervisorId: 'S01', discountLimitBp: 500 };
const c001: Client = {
  id: 'C001',
  tradeName: 'Mercadinho São José',
  sellerId: 'V01',
  priceTableId: 'TP01',
  priceTableFallback: false,
  creditLimitCents: 500_000,
  creditUsedCents: 0,
};
const quote = (overrides: Partial<ProductQuote> & { productId: string }): ProductQuote => ({
  sku: `SKU-${overrides.productId}`,
  ean: '7890000000000',
  description: `Product ${overrides.productId}`,
  active: true,
  saleUnit: 'UN',
  packFactor: 1,
  multipleOnly: false,
  hasPrice: true,
  unitPriceCents: 10_000,
  ...overrides,
});

// In-memory stand-in for the repository: same contract, no database. The
// conditional updates behave like the real ones: they only match an order that
// is still awaiting approval.
class FakeOrdersRepository {
  saved = new Map<string, OrderWithItems>();
  private clock = 0;
  private stamp() {
    return new Date(T0.getTime() + this.clock++);
  }
  async findById(id: string) {
    return this.saved.get(id) ?? null;
  }
  async insert(order: NewOrder, items: NewOrderItem[], firstStep: NewHistory) {
    if (this.saved.has(order.id!)) {
      return false;
    }
    this.saved.set(order.id!, {
      order: { ...order, createdAt: T0, origin: 'SYSTEM', rejectionReasonCode: null, rejectionReasonText: null } as OrderWithItems['order'],
      items: items as OrderWithItems['items'],
      history: [{ id: 1, orderId: order.id!, reasonCode: null, reasonText: null, createdAt: T0, ...firstStep }] as OrderWithItems['history'],
    });
    return true;
  }
  async listBySeller(sellerId: string, limit: number) {
    return [...this.saved.values()]
      .map((o) => o.order)
      .filter((o) => o.sellerId === sellerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async listByClient(sellerId: string, clientId: string, limit: number) {
    return [...this.saved.values()]
      .map((o) => o.order)
      .filter((o) => o.sellerId === sellerId && o.clientId === clientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  async itemCounts(ids: string[]) {
    return new Map(ids.map((id) => [id, this.saved.get(id)?.items.length ?? 0]));
  }
  async listPendingApproval(supervisorId: string) {
    return [...this.saved.values()].map((o) => o.order).filter((o) => o.supervisorId === supervisorId && o.status === 'AWAITING_APPROVAL');
  }
  async applyApproval(orderId: string, by: string) {
    const found = this.saved.get(orderId);
    if (!found || found.order.status !== 'AWAITING_APPROVAL') {
      return false;
    }
    found.order.status = 'SUBMITTED';
    found.history.push(
      { id: found.history.length + 1, orderId, status: 'APPROVED', actor: `user:${by}`, reasonCode: null, reasonText: null, createdAt: this.stamp() },
      { id: found.history.length + 2, orderId, status: 'SUBMITTED', actor: 'system:orders', reasonCode: null, reasonText: null, createdAt: this.stamp() },
    );
    return true;
  }
  async applyRejection(orderId: string, by: string, reason: { code: string; text: string | null }) {
    const found = this.saved.get(orderId);
    if (!found || found.order.status !== 'AWAITING_APPROVAL') {
      return false;
    }
    found.order.status = 'CANCELLED';
    found.order.rejectionReasonCode = reason.code;
    found.order.rejectionReasonText = reason.text;
    found.history.push(
      { id: found.history.length + 1, orderId, status: 'REJECTED', actor: `user:${by}`, reasonCode: reason.code, reasonText: reason.text, createdAt: this.stamp() },
      { id: found.history.length + 2, orderId, status: 'CANCELLED', actor: 'system:orders', reasonCode: null, reasonText: null, createdAt: this.stamp() },
    );
    return true;
  }
}

function build(overrides: { clients?: Record<string, Client>; quotes?: ProductQuote[] } = {}) {
  const repository = new FakeOrdersRepository();
  const clients = overrides.clients ?? { C001: c001 };
  const getClient = vi.fn(async (id: string) => clients[id] ?? null);
  const getSeller = vi.fn(async (id: string) => (id === 'V01' ? v01 : null));
  const getProducts = vi.fn(async (_table: string, ids: string[]) =>
    (overrides.quotes ?? [quote({ productId: 'P1' }), quote({ productId: 'P2', packFactor: 12, multipleOnly: true })]).filter((q) =>
      ids.includes(q.productId),
    ),
  );
  const reserveCredit = vi.fn(async (_clientId: string, _orderId: string, _amountCents: number) => ({ reserved: true, availableCents: 100_000 }));
  const releaseCredit = vi.fn(async (_orderId: string) => undefined);
  const publishPlaced = vi.fn(async (_event: OrderPlacedEvent) => undefined);
  const publishSubmitted = vi.fn(async (_event: OrderSubmittedEvent) => undefined);
  const publishApproved = vi.fn(async (_event: OrderApprovedEvent) => undefined);
  const publishRejected = vi.fn(async (_event: OrderRejectedEvent) => undefined);
  const identity: IdentityGateway = { getClient, getSeller, reserveCredit, releaseCredit };
  const catalog: CatalogGateway = { getProducts };
  const publisher: OrderEventsPublisher = { publishPlaced, publishSubmitted, publishApproved, publishRejected };
  const service = new OrdersService(repository as unknown as OrdersRepository, identity, catalog, publisher, env);
  return { service, repository, getClient, getSeller, getProducts, reserveCredit, releaseCredit, publishPlaced, publishSubmitted, publishApproved, publishRejected };
}

const draft = (overrides: Partial<CalculateOrderDto> = {}): CalculateOrderDto => ({
  clientId: 'C001',
  items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 0 }],
  orderDiscountBp: 0,
  ...overrides,
});
const submission = (overrides: Partial<SubmitOrderDto> = {}): SubmitOrderDto => ({ orderId: ORDER_ID, ...draft(), ...overrides });
// 6% is above the seller's 5% limit: the order waits for a supervisor.
const needsApproval = () => submission({ items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 600 }] });

describe('OrdersService.calculate', () => {
  it('prices the order with the table of the client and reports the client', async () => {
    const { service, getProducts } = build();
    const result = await service.calculate(seller, draft());
    expect(getProducts).toHaveBeenCalledWith('TP01', ['P1']);
    expect(result).toMatchObject({ totalCents: 50_000, canSubmit: true, status: 'SUBMITTED' });
    expect(result.client).toEqual({ id: 'C001', tradeName: 'Mercadinho São José', priceTableId: 'TP01', priceTableFallback: false });
  });

  it('asks the catalog once for all the lines', async () => {
    const { service, getProducts } = build();
    await service.calculate(seller, draft({ items: [
      { productId: 'P1', quantity: 1, unit: 'UNIT', discountBp: 0 },
      { productId: 'P2', quantity: 12, unit: 'UNIT', discountBp: 0 },
    ] }));
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith('TP01', ['P1', 'P2']);
  });

  it('uses the seller limit from identity to decide on approval', async () => {
    const { service } = build();
    const result = await service.calculate(seller, draft({ items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 600 }] }));
    expect(result.status).toBe('AWAITING_APPROVAL');
    expect(result.effectiveDiscountLimitBp).toBe(500);
  });

  it('reports every blocking reason instead of failing', async () => {
    const { service } = build();
    const result = await service.calculate(seller, draft({ items: [{ productId: 'P2', quantity: 5, unit: 'UNIT', discountBp: 0 }] }));
    expect(result.lines[0].blockers).toEqual(['NOT_PACK_MULTIPLE']);
    expect(result.canSubmit).toBe(false);
  });

  it('refuses a supervisor: only a seller builds an order', async () => {
    const { service } = build();
    await expect(service.calculate(supervisor, draft())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("answers not found for another seller's client, like a missing one", async () => {
    const { service } = build({ clients: { C001: { ...c001, sellerId: 'V02' } } });
    await expect(service.calculate(seller, draft())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers not found for an unknown client', async () => {
    const { service } = build();
    await expect(service.calculate(seller, draft({ clientId: 'C999' }))).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService.submit', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('saves a valid order with the prices as they were, the names and the supervisor, and returns it', async () => {
    const view = await ctx.service.submit(seller, submission({ items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 100 }] }));
    expect(view).toMatchObject({
      id: ORDER_ID, status: 'SUBMITTED', sellerId: 'V01', sellerName: 'Carlos Menezes', supervisorId: 'S01',
      clientId: 'C001', clientTradeName: 'Mercadinho São José', totalCents: 49_500,
    });
    expect(view.items[0]).toMatchObject({ productId: 'P1', sku: 'SKU-P1', unitPriceCents: 10_000, grossCents: 50_000, netCents: 49_500 });
    expect(view.history.map((h) => [h.status, h.actor])).toEqual([['SUBMITTED', 'user:V01']]);
  });

  it('stores a pack as units and remembers how it was entered', async () => {
    const view = await ctx.service.submit(seller, submission({ items: [{ productId: 'P2', quantity: 3, unit: 'PACK', discountBp: 0 }] }));
    expect(view.items[0]).toMatchObject({ unit: 'PACK', quantityInput: 3, quantityUnits: 36, packFactor: 12 });
    expect(view.totalCents).toBe(360_000);
  });

  it('keeps an order above the discount limit as awaiting approval, with the reason', async () => {
    const view = await ctx.service.submit(seller, needsApproval());
    expect(view.status).toBe('AWAITING_APPROVAL');
    expect(view.approvalReasons).toEqual([{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P1', discountBp: 600 }]);
  });

  it('announces an order within the limit as placed and then as submitted', async () => {
    await ctx.service.submit(seller, submission({ items: [{ productId: 'P2', quantity: 3, unit: 'PACK', discountBp: 0 }] }));
    const ref = { orderId: ORDER_ID, sellerId: 'V01', supervisorId: 'S01', clientId: 'C001', clientTradeName: 'Mercadinho São José', totalCents: 360_000 };
    expect(ctx.publishPlaced).toHaveBeenCalledWith({
      ...ref, status: 'SUBMITTED', items: [{ productId: 'P2', quantity: 36 }], placedAt: '2026-10-24T12:00:00.000Z',
    });
    expect(ctx.publishSubmitted).toHaveBeenCalledWith({
      ...ref, items: [{ productId: 'P2', quantity: 36 }], submittedAt: '2026-10-24T12:00:00.000Z',
    });
  });

  it('announces an order awaiting approval as placed only: it has not been submitted', async () => {
    await ctx.service.submit(seller, needsApproval());
    expect(ctx.publishPlaced).toHaveBeenCalledWith(expect.objectContaining({ orderId: ORDER_ID, status: 'AWAITING_APPROVAL' }));
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it('refuses an order that breaks a rule, with the calculation, and saves and publishes nothing', async () => {
    const bad = submission({ items: [{ productId: 'P2', quantity: 5, unit: 'UNIT', discountBp: 0 }] });
    const error = await ctx.service.submit(seller, bad).catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({ code: 'ORDER_NOT_SUBMITTABLE', calculation: { canSubmit: false } });
    expect(ctx.repository.saved.size).toBe(0);
    expect(ctx.publishPlaced).not.toHaveBeenCalled();
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it('refuses an order below the minimum', async () => {
    const small = submission({ items: [{ productId: 'P1', quantity: 2, unit: 'UNIT', discountBp: 0 }] });
    const error = await ctx.service.submit(seller, small).catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse().calculation.blockers).toContain('BELOW_MINIMUM');
  });

  it('is idempotent: the same order id returns the saved order without recalculating or publishing again', async () => {
    const first = await ctx.service.submit(seller, submission());
    const again = await ctx.service.submit(seller, submission());
    expect(again).toEqual(first);
    expect(ctx.getClient).toHaveBeenCalledTimes(1);
    expect(ctx.publishPlaced).toHaveBeenCalledTimes(1);
  });

  it('returns the winner of a race on the same order id, and does not publish twice', async () => {
    // The first read finds nothing, then another request saves the order before this insert.
    const winner = await ctx.service.submit(seller, submission());
    ctx.repository.findById = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(ctx.repository.saved.get(ORDER_ID));
    ctx.repository.insert = vi.fn().mockResolvedValue(false);
    ctx.publishPlaced.mockClear();
    ctx.publishSubmitted.mockClear();

    const loser = await ctx.service.submit(seller, submission());
    expect(loser).toEqual(winner);
    expect(ctx.publishPlaced).not.toHaveBeenCalled();
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it("does not hand one seller another seller's order through a reused id", async () => {
    await ctx.service.submit(seller, submission());
    await expect(ctx.service.submit({ role: 'SELLER', id: 'V02' }, submission())).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService credit', () => {
  it('blocks an order that does not fit in the credit the client has left, when calculating', async () => {
    // limit 5.000,00, used 4.900,00 -> 100,00 left; the order is 500,00.
    const { service } = build({ clients: { C001: { ...c001, creditUsedCents: 490_000 } } });
    const result = await service.calculate(seller, draft());
    expect(result.availableCreditCents).toBe(10_000);
    expect(result.blockers).toContain('CREDIT_EXCEEDED');
    expect(result.canSubmit).toBe(false);
  });

  it('holds the credit for the order id, for the order total, before saving', async () => {
    const ctx = build();
    await ctx.service.submit(seller, submission());
    expect(ctx.reserveCredit).toHaveBeenCalledWith('C001', ORDER_ID, 50_000);
  });

  it('refuses the order when identity says the credit does not fit, saving and publishing nothing', async () => {
    const ctx = build();
    ctx.reserveCredit.mockResolvedValue({ reserved: false, availableCents: 12_000 });
    const error = await ctx.service.submit(seller, submission()).catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse().calculation).toMatchObject({ canSubmit: false, availableCreditCents: 12_000 });
    expect(error.getResponse().calculation.blockers).toContain('CREDIT_EXCEEDED');
    expect(ctx.repository.saved.size).toBe(0);
    expect(ctx.publishPlaced).not.toHaveBeenCalled();
  });

  it('does not hold credit for an order a rule already blocked', async () => {
    const ctx = build();
    const bad = submission({ items: [{ productId: 'P1', quantity: 2, unit: 'UNIT', discountBp: 0 }] });
    await ctx.service.submit(seller, bad).catch(() => undefined);
    expect(ctx.reserveCredit).not.toHaveBeenCalled();
  });

  it('gives the credit back at once when the order cannot be saved', async () => {
    const ctx = build();
    ctx.repository.insert = vi.fn().mockRejectedValue(new Error('database is down'));
    await expect(ctx.service.submit(seller, submission())).rejects.toThrow('database is down');
    expect(ctx.releaseCredit).toHaveBeenCalledWith(ORDER_ID);
    expect(ctx.publishPlaced).not.toHaveBeenCalled();
  });

  it('still reports the original failure when giving the credit back also fails', async () => {
    const ctx = build();
    ctx.repository.insert = vi.fn().mockRejectedValue(new Error('database is down'));
    ctx.releaseCredit.mockRejectedValue(new Error('identity is down'));
    await expect(ctx.service.submit(seller, submission())).rejects.toThrow('database is down');
  });

  it('does not hold credit again when the same order is sent again', async () => {
    const ctx = build();
    await ctx.service.submit(seller, submission());
    await ctx.service.submit(seller, submission());
    expect(ctx.reserveCredit).toHaveBeenCalledTimes(1);
  });
});

describe('OrdersService.getOrder', () => {
  it('returns the order to the seller who sent it', async () => {
    const { service } = build();
    await service.submit(seller, submission());
    expect(await service.getOrder(seller, ORDER_ID)).toMatchObject({ id: ORDER_ID });
  });

  it('returns the order to the supervisor who has to decide on it', async () => {
    const { service } = build();
    await service.submit(seller, needsApproval());
    expect(await service.getOrder(supervisor, ORDER_ID)).toMatchObject({ id: ORDER_ID, status: 'AWAITING_APPROVAL' });
  });

  it("answers not found for another seller, another team's supervisor, and a missing id", async () => {
    const { service } = build();
    await service.submit(seller, needsApproval());
    await expect(service.getOrder({ role: 'SELLER', id: 'V02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrder({ role: 'SUPERVISOR', id: 'S02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrder(seller, '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService.pendingApprovals', () => {
  it("lists the orders awaiting approval of the supervisor's team, with names and reasons", async () => {
    const { service } = build();
    await service.submit(seller, needsApproval());
    const [item] = await service.pendingApprovals(supervisor);
    expect(item).toMatchObject({ id: ORDER_ID, sellerName: 'Carlos Menezes', clientTradeName: 'Mercadinho São José', totalCents: 47_000 });
    expect(item.approvalReasons).toEqual([{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P1', discountBp: 600 }]);
  });

  it('leaves out an order sent straight away and an order of another team', async () => {
    const { service } = build();
    await service.submit(seller, needsApproval());
    expect(await service.pendingApprovals({ role: 'SUPERVISOR', id: 'S02' })).toEqual([]);
    const other = build();
    await other.service.submit(seller, submission());
    expect(await other.service.pendingApprovals(supervisor)).toEqual([]);
  });

  it('is not for sellers', async () => {
    const { service } = build();
    await expect(service.pendingApprovals(seller)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('OrdersService.approve', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(async () => {
    ctx = build();
    await ctx.service.submit(seller, needsApproval());
    ctx.publishPlaced.mockClear();
    ctx.publishSubmitted.mockClear();
  });

  it('sends the order: approved, then submitted, both in the history', async () => {
    const view = await ctx.service.approve(supervisor, ORDER_ID);
    expect(view.status).toBe('SUBMITTED');
    expect(view.history.map((h) => [h.status, h.actor])).toEqual([
      ['AWAITING_APPROVAL', 'user:V01'],
      ['APPROVED', 'user:S01'],
      ['SUBMITTED', 'system:orders'],
    ]);
  });

  it('announces the approval and then the submission', async () => {
    await ctx.service.approve(supervisor, ORDER_ID);
    // Every event says whom the order is about, so a consumer can address a message.
    expect(ctx.publishApproved).toHaveBeenCalledWith({
      orderId: ORDER_ID, sellerId: 'V01', supervisorId: 'S01', clientId: 'C001', clientTradeName: 'Mercadinho São José', totalCents: 47_000,
      approvedBy: 'S01', approvedAt: expect.any(String),
    });
    expect(ctx.publishSubmitted).toHaveBeenCalledWith(expect.objectContaining({ orderId: ORDER_ID, clientId: 'C001', totalCents: 47_000 }));
    const approved = ctx.publishApproved.mock.invocationCallOrder[0];
    const submitted = ctx.publishSubmitted.mock.invocationCallOrder[0];
    expect(approved).toBeLessThan(submitted);
  });

  it('keeps the credit held: approving gives nothing back', async () => {
    await ctx.service.approve(supervisor, ORDER_ID);
    expect(ctx.releaseCredit).not.toHaveBeenCalled();
  });

  it('is a repeat, not an error, to approve an approved order, and announces nothing again', async () => {
    const first = await ctx.service.approve(supervisor, ORDER_ID);
    ctx.publishApproved.mockClear();
    ctx.publishSubmitted.mockClear();
    expect(await ctx.service.approve(supervisor, ORDER_ID)).toEqual(first);
    expect(ctx.publishApproved).not.toHaveBeenCalled();
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it('refuses to approve a rejected order', async () => {
    await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'CREDIT_RISK' });
    const error = await ctx.service.approve(supervisor, ORDER_ID).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'ALREADY_REJECTED' });
  });

  it('refuses to approve an order that never needed approval', async () => {
    const plain = build();
    await plain.service.submit(seller, submission());
    const error = await plain.service.approve(supervisor, ORDER_ID).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'NOT_AWAITING_APPROVAL' });
  });

  it('is for the supervisor of the order only: others get "not found" or "forbidden", and nothing changes', async () => {
    await expect(ctx.service.approve({ role: 'SUPERVISOR', id: 'S02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctx.service.approve(seller, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await ctx.repository.findById(ORDER_ID))?.order.status).toBe('AWAITING_APPROVAL');
  });

  it('decides again when another decision lands between reading and updating', async () => {
    // The order is read as waiting, but a rejection gets in before the approval is applied.
    const real = ctx.repository.applyApproval.bind(ctx.repository);
    ctx.repository.applyApproval = vi.fn(async (id: string, by: string) => {
      await ctx.repository.applyRejection(id, 'S01', { code: 'CREDIT_RISK', text: null });
      return real(id, by);
    });
    const error = await ctx.service.approve(supervisor, ORDER_ID).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'ALREADY_REJECTED' });
    expect(ctx.publishApproved).not.toHaveBeenCalled();
  });
});

describe('OrdersService.reject', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(async () => {
    ctx = build();
    await ctx.service.submit(seller, needsApproval());
    ctx.publishPlaced.mockClear();
  });

  it('rejects with the reason, keeps it, records who did it, and ends cancelled', async () => {
    const view = await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'OTHER', reasonText: '  Cliente desistiu  ' });
    expect(view.status).toBe('CANCELLED');
    expect(view.rejection).toEqual({ code: 'OTHER', text: 'Cliente desistiu' });
    expect(view.history.map((h) => [h.status, h.actor])).toEqual([
      ['AWAITING_APPROVAL', 'user:V01'],
      ['REJECTED', 'user:S01'],
      ['CANCELLED', 'system:orders'],
    ]);
    expect(view.history[1]).toMatchObject({ reasonCode: 'OTHER', reasonText: 'Cliente desistiu' });
  });

  it('gives the credit back at once and announces the rejection with its reason', async () => {
    await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'DISCOUNT_TOO_HIGH' });
    expect(ctx.releaseCredit).toHaveBeenCalledWith(ORDER_ID);
    expect(ctx.publishRejected).toHaveBeenCalledWith({
      orderId: ORDER_ID, sellerId: 'V01', supervisorId: 'S01', clientId: 'C001', clientTradeName: 'Mercadinho São José', totalCents: 47_000,
      rejectedBy: 'S01', reasonCode: 'DISCOUNT_TOO_HIGH', rejectedAt: expect.any(String),
    });
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it('carries the free text of OTHER in the event', async () => {
    await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'OTHER', reasonText: 'Cliente desistiu' });
    expect(ctx.publishRejected).toHaveBeenCalledWith(expect.objectContaining({ reasonCode: 'OTHER', reasonText: 'Cliente desistiu' }));
  });

  it('still rejects, and announces it, when giving the credit back fails: the event releases it', async () => {
    ctx.releaseCredit.mockRejectedValue(new Error('identity is down'));
    const view = await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'CREDIT_RISK' });
    expect(view.status).toBe('CANCELLED');
    expect(ctx.publishRejected).toHaveBeenCalledTimes(1);
  });

  it('is a repeat to reject a rejected order: nothing is released or announced again', async () => {
    const first = await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'CREDIT_RISK' });
    ctx.releaseCredit.mockClear();
    ctx.publishRejected.mockClear();
    expect(await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'OTHER', reasonText: 'something else' })).toEqual(first);
    expect(ctx.releaseCredit).not.toHaveBeenCalled();
    expect(ctx.publishRejected).not.toHaveBeenCalled();
  });

  it('refuses to reject an order that was already sent', async () => {
    await ctx.service.approve(supervisor, ORDER_ID);
    const error = await ctx.service.reject(supervisor, ORDER_ID, { reasonCode: 'CREDIT_RISK' }).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'ALREADY_SUBMITTED' });
  });

  it('is for the supervisor of the order only', async () => {
    await expect(ctx.service.reject({ role: 'SUPERVISOR', id: 'S02' }, ORDER_ID, { reasonCode: 'CREDIT_RISK' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctx.service.reject(seller, ORDER_ID, { reasonCode: 'CREDIT_RISK' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.releaseCredit).not.toHaveBeenCalled();
  });
});

describe('OrdersService.listClientOrders', () => {
  it('lists the orders of the seller for one client, with total, items and status', async () => {
    const { service } = build();
    await service.submit(seller, submission());
    const [row] = await service.listClientOrders(seller, 'C001', 10);
    expect(row).toMatchObject({ id: ORDER_ID, clientId: 'C001', status: 'SUBMITTED', origin: 'SYSTEM', totalCents: 50_000, itemCount: 1, createdAt: '2026-10-24T12:00:00.000Z' });
  });

  it("never lists another seller's orders, or another client's", async () => {
    const { service } = build();
    await service.submit(seller, submission());
    expect(await service.listClientOrders({ role: 'SELLER', id: 'V02' }, 'C001', 10)).toEqual([]);
    expect(await service.listClientOrders(seller, 'C002', 10)).toEqual([]);
  });

  it('lists the orders of every client of the seller when no client is given, and never another seller\'s', async () => {
    const { service } = build();
    await service.submit(seller, submission());
    const rows = await service.listClientOrders(seller, undefined, 10);
    expect(rows.map((r) => r.id)).toEqual([ORDER_ID]);
    expect(rows[0]).toMatchObject({ clientId: 'C001' });
    expect(await service.listClientOrders({ role: 'SELLER', id: 'V02' }, undefined, 10)).toEqual([]);
  });

  it('respects the limit', async () => {
    const ctx = build();
    await ctx.service.submit(seller, submission({ orderId: '11111111-1111-4111-8111-111111111111' }));
    await ctx.service.submit(seller, submission({ orderId: '22222222-2222-4222-8222-222222222222' }));
    expect(await ctx.service.listClientOrders(seller, 'C001', 1)).toHaveLength(1);
  });

  it('is for sellers', async () => {
    const { service } = build();
    await expect(service.listClientOrders(supervisor, 'C001', 10)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('OrdersService.repeatDraft', () => {
  const twoLines = () =>
    submission({
      items: [
        { productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 100 },
        { productId: 'P2', quantity: 3, unit: 'PACK', discountBp: 0 },
      ],
    });

  it('repeats the products, quantities and units, and starts every discount at zero', async () => {
    const { service } = build();
    await service.submit(seller, twoLines());
    const draft = await service.repeatDraft(seller, ORDER_ID);
    expect(draft).toMatchObject({ sourceOrderId: ORDER_ID, clientId: 'C001', skipped: [] });
    expect(draft.items.map((i) => [i.productId, i.quantity, i.unit, i.discountBp])).toEqual([
      ['P1', 5, 'UNIT', 0],
      ['P2', 3, 'PACK', 0],
    ]);
    expect(draft.items[1]).toMatchObject({ packFactor: 12, multipleOnly: true, sku: 'SKU-P2' });
  });

  it("asks the catalog for the client's current price table, once for all the lines", async () => {
    const { service, getProducts } = build();
    await service.submit(seller, twoLines());
    getProducts.mockClear();
    await service.repeatDraft(seller, ORDER_ID);
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith('TP01', ['P1', 'P2']);
  });

  it('leaves out a product that was discontinued since, and says why', async () => {
    const { service, repository } = build({ quotes: [quote({ productId: 'P1' }), quote({ productId: 'P2', packFactor: 12, multipleOnly: true })] });
    await service.submit(seller, twoLines());
    // The catalog changes after the order was made.
    const later = build({ quotes: [quote({ productId: 'P1', active: false }), quote({ productId: 'P2', packFactor: 12, multipleOnly: true })] });
    later.repository.saved = repository.saved;
    const draft = await later.service.repeatDraft(seller, ORDER_ID);
    expect(draft.items.map((i) => i.productId)).toEqual(['P2']);
    expect(draft.skipped).toEqual([{ productId: 'P1', description: 'Product P1', reason: 'DISCONTINUED' }]);
  });

  it('answers not found for an order of another seller, an unknown order, and a client that moved away', async () => {
    const { service, repository } = build();
    await service.submit(seller, twoLines());
    await expect(service.repeatDraft({ role: 'SELLER', id: 'V02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.repeatDraft(seller, '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
    const moved = build({ clients: { C001: { ...c001, sellerId: 'V02' } } });
    moved.repository.saved = repository.saved;
    await expect(moved.service.repeatDraft(seller, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not let the seller who now owns a client repeat the previous seller's order", async () => {
    // V01 made the order; the client has since passed to V02. The client check alone would let V02 in.
    const { repository } = build();
    const first = build();
    await first.service.submit(seller, twoLines());
    const afterTransfer = build({ clients: { C001: { ...c001, sellerId: 'V02' } } });
    afterTransfer.repository.saved = first.repository.saved;
    await expect(afterTransfer.service.repeatDraft({ role: 'SELLER', id: 'V02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.saved.size).toBe(0);
  });

  it('is for sellers, and saves and publishes nothing', async () => {
    const ctx = build();
    await ctx.service.submit(seller, twoLines());
    ctx.publishPlaced.mockClear();
    await expect(ctx.service.repeatDraft(supervisor, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await ctx.service.repeatDraft(seller, ORDER_ID);
    expect(ctx.repository.saved.size).toBe(1);
    expect(ctx.publishPlaced).not.toHaveBeenCalled();
    expect(ctx.reserveCredit).toHaveBeenCalledTimes(1);
  });
});

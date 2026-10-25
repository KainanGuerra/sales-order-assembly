import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { OrderSubmittedEvent } from 'contracts';
import type { ProductQuote } from 'contracts/catalog';
import type { Client, Seller } from 'contracts/identity';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { Actor } from '../../../shared/actor.js';
import type { CatalogGateway } from '../clients/catalog.client.js';
import type { IdentityGateway } from '../clients/identity.client.js';
import type { OrderEventsPublisher } from '../clients/order-events.publisher.js';
import type { CalculateOrderDto, SubmitOrderDto } from '../dto/orders.dto.js';
import type { NewOrder, NewOrderItem, OrderWithItems } from '../repository/orders.repository.js';
import { OrdersRepository } from '../repository/orders.repository.js';
import { OrdersService } from './orders.service.js';

const env = { MIN_ORDER_CENTS: 30_000, MAX_DISCOUNT_BP: 1_000 } as Env;
const seller: Actor = { role: 'SELLER', id: 'V01' };
const ORDER_ID = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';

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

// In-memory stand-in for the repository: same contract, no database.
class FakeOrdersRepository {
  saved = new Map<string, OrderWithItems>();
  async findById(id: string) {
    return this.saved.get(id) ?? null;
  }
  async insert(order: NewOrder, items: NewOrderItem[]) {
    if (this.saved.has(order.id!)) {
      return false;
    }
    this.saved.set(order.id!, {
      order: { ...order, createdAt: new Date('2026-10-24T12:00:00Z') } as OrderWithItems['order'],
      items: items as OrderWithItems['items'],
    });
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
  const publishSubmitted = vi.fn(async (_event: OrderSubmittedEvent) => undefined);
  const identity: IdentityGateway = { getClient, getSeller };
  const catalog: CatalogGateway = { getProducts };
  const publisher: OrderEventsPublisher = { publishSubmitted };
  const service = new OrdersService(repository as unknown as OrdersRepository, identity, catalog, publisher, env);
  return { service, repository, getClient, getSeller, getProducts, publishSubmitted };
}

const draft = (overrides: Partial<CalculateOrderDto> = {}): CalculateOrderDto => ({
  clientId: 'C001',
  items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 0 }],
  orderDiscountBp: 0,
  ...overrides,
});
const submission = (overrides: Partial<SubmitOrderDto> = {}): SubmitOrderDto => ({ orderId: ORDER_ID, ...draft(), ...overrides });

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

  it('does not call the catalog for an empty order', async () => {
    const { service, getProducts } = build();
    const result = await service.calculate(seller, draft({ items: [] }));
    expect(result.blockers).toEqual(['EMPTY_ORDER']);
    expect(getProducts).toHaveBeenCalledWith('TP01', []);
  });

  it('refuses a supervisor: only a seller builds an order', async () => {
    const { service } = build();
    await expect(service.calculate({ role: 'SUPERVISOR', id: 'S01' }, draft())).rejects.toBeInstanceOf(ForbiddenException);
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

  it('saves a valid order with the prices as they were, and returns it', async () => {
    const view = await ctx.service.submit(seller, submission({ items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 100 }] }));
    expect(view).toMatchObject({ id: ORDER_ID, status: 'SUBMITTED', sellerId: 'V01', clientId: 'C001', totalCents: 49_500 });
    expect(view.items[0]).toMatchObject({ productId: 'P1', sku: 'SKU-P1', unitPriceCents: 10_000, grossCents: 50_000, netCents: 49_500 });
    expect(ctx.repository.saved.has(ORDER_ID)).toBe(true);
  });

  it('stores a pack as units and remembers how it was entered', async () => {
    const view = await ctx.service.submit(seller, submission({ items: [{ productId: 'P2', quantity: 3, unit: 'PACK', discountBp: 0 }] }));
    expect(view.items[0]).toMatchObject({ unit: 'PACK', quantityInput: 3, quantityUnits: 36, packFactor: 12 });
    expect(view.totalCents).toBe(360_000);
  });

  it('keeps an order above the discount limit as awaiting approval, with the reason', async () => {
    const view = await ctx.service.submit(seller, submission({ items: [{ productId: 'P1', quantity: 5, unit: 'UNIT', discountBp: 600 }] }));
    expect(view.status).toBe('AWAITING_APPROVAL');
    expect(view.approvalReasons).toEqual([{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P1', discountBp: 600 }]);
  });

  it('publishes OrderSubmitted with the supervisor and the quantities in units', async () => {
    await ctx.service.submit(seller, submission({ items: [{ productId: 'P2', quantity: 3, unit: 'PACK', discountBp: 0 }] }));
    expect(ctx.publishSubmitted).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      clientId: 'C001',
      sellerId: 'V01',
      supervisorId: 'S01',
      status: 'SUBMITTED',
      totalCents: 360_000,
      items: [{ productId: 'P2', quantity: 36 }],
      submittedAt: '2026-10-24T12:00:00.000Z',
    });
  });

  it('refuses an order that breaks a rule, with the calculation, and saves and publishes nothing', async () => {
    // 4 x 100.00 = 400.00, then 2 units of a 12-pack product: not a multiple.
    const bad = submission({ items: [{ productId: 'P2', quantity: 5, unit: 'UNIT', discountBp: 0 }] });
    const error = await ctx.service.submit(seller, bad).catch((e) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({ code: 'ORDER_NOT_SUBMITTABLE', calculation: { canSubmit: false } });
    expect(ctx.repository.saved.size).toBe(0);
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
    expect(ctx.publishSubmitted).toHaveBeenCalledTimes(1);
  });

  it('returns the winner of a race on the same order id, and does not publish twice', async () => {
    // The first read finds nothing, then another request saves the order before this insert.
    const winner = await ctx.service.submit(seller, submission());
    ctx.repository.findById = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(ctx.repository.saved.get(ORDER_ID));
    ctx.repository.insert = vi.fn().mockResolvedValue(false);
    ctx.publishSubmitted.mockClear();

    const loser = await ctx.service.submit(seller, submission());
    expect(loser).toEqual(winner);
    expect(ctx.publishSubmitted).not.toHaveBeenCalled();
  });

  it("does not hand one seller another seller's order through a reused id", async () => {
    await ctx.service.submit(seller, submission());
    const other: Actor = { role: 'SELLER', id: 'V02' };
    await expect(ctx.service.submit(other, submission())).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdersService.getOrder', () => {
  it('returns the order of the seller who asks', async () => {
    const { service } = build();
    await service.submit(seller, submission());
    expect(await service.getOrder(seller, ORDER_ID)).toMatchObject({ id: ORDER_ID });
  });

  it("answers not found for another seller's order, for a supervisor, and for a missing id", async () => {
    const { service } = build();
    await service.submit(seller, submission());
    await expect(service.getOrder({ role: 'SELLER', id: 'V02' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrder({ role: 'SUPERVISOR', id: 'S01' }, ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrder(seller, '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});

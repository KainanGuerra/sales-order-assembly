import { describe, expect, it } from 'vitest';
import {
  calculateOrder,
  divideRoundHalfUp,
  type CatalogProduct,
  type OrderInput,
  type OrderLineInput,
  type OrderPolicy,
} from './order-rules.js';

const product = (overrides: Partial<CatalogProduct> & { productId: string }): CatalogProduct => ({
  description: overrides.productId,
  active: true,
  packFactor: 1,
  multipleOnly: false,
  hasPrice: true,
  unitPriceCents: 1000,
  ...overrides,
});

const catalog = (...products: CatalogProduct[]) => new Map(products.map((p) => [p.productId, p]));
const line = (productId: string, quantity: number, overrides: Partial<OrderLineInput> = {}): OrderLineInput => ({
  productId,
  quantity,
  unit: 'UNIT',
  discountBp: 0,
  ...overrides,
});
const order = (items: OrderLineInput[], orderDiscountBp = 0): OrderInput => ({ items, orderDiscountBp });

// Seller with a 5% limit, no global cap below it, and no minimum, unless a test says otherwise.
const policy = (overrides: Partial<OrderPolicy> = {}): OrderPolicy => ({
  sellerDiscountLimitBp: 500,
  maxDiscountBp: 10_000,
  minimumOrderCents: 0,
  ...overrides,
});

describe('divideRoundHalfUp', () => {
  it('rounds half up', () => {
    expect(divideRoundHalfUp(9405, 10)).toBe(941);
    expect(divideRoundHalfUp(9404, 10)).toBe(940);
    expect(divideRoundHalfUp(9406, 10)).toBe(941);
  });

  it('is exact when there is no remainder', () => {
    expect(divideRoundHalfUp(100, 10)).toBe(10);
  });
});

// The worked examples from ASSUMPTIONS.md (method 1: round each line).
describe('rounding', () => {
  const products = catalog(
    product({ productId: 'A', unitPriceCents: 749 }),
    product({ productId: 'B', unitPriceCents: 899 }),
    product({ productId: 'C', unitPriceCents: 333 }),
    product({ productId: 'X', unitPriceCents: 99 }),
    product({ productId: 'Y', unitPriceCents: 99 }),
    product({ productId: 'A2', unitPriceCents: 749 }),
    product({ productId: 'Z', unitPriceCents: 8650 }),
  );

  it('example 1: three lines are rounded one by one', () => {
    const result = calculateOrder(
      order([line('A', 15, { discountBp: 500 }), line('B', 12), line('C', 7, { discountBp: 300 })]),
      products,
      policy({ sellerDiscountLimitBp: 700 }),
    );
    expect(result.lines.map((l) => l.netCents)).toEqual([10673, 10788, 2261]);
    expect(result.subtotalCents).toBe(23722);
    expect(result.totalCents).toBe(23722);
  });

  it('example 2: lines at x.5 cents round up and the total is the sum of the lines', () => {
    const result = calculateOrder(
      order([line('X', 10, { discountBp: 500 }), line('Y', 10, { discountBp: 500 })]),
      products,
      policy(),
    );
    expect(result.lines.map((l) => l.netCents)).toEqual([941, 941]);
    expect(result.totalCents).toBe(1882);
  });

  it('example 3: the same order is blocked at 299.96', () => {
    const result = calculateOrder(
      order([line('A', 15, { discountBp: 500 }), line('A2', 15, { discountBp: 500 }), line('Z', 1)]),
      products,
      policy({ minimumOrderCents: 30_000 }),
    );
    expect(result.totalCents).toBe(29_996);
    expect(result.blockers).toContain('BELOW_MINIMUM');
    expect(result.canSubmit).toBe(false);
  });

  it('example 4: the order discount applies to the sum of the rounded lines, rounded once', () => {
    const result = calculateOrder(
      order([line('A', 15, { discountBp: 500 }), line('B', 12), line('C', 7, { discountBp: 300 })], 200),
      products,
      policy({ sellerDiscountLimitBp: 700 }),
    );
    expect(result.orderDiscountCents).toBe(474);
    expect(result.totalCents).toBe(23_248);
  });
});

describe('minimum order', () => {
  const products = catalog(product({ productId: 'P', unitPriceCents: 29_999 }), product({ productId: 'Q', unitPriceCents: 30_000 }));
  const minimum = policy({ minimumOrderCents: 30_000 });

  it('blocks R$ 299.99', () => {
    const result = calculateOrder(order([line('P', 1)]), products, minimum);
    expect(result.blockers).toEqual(['BELOW_MINIMUM']);
    expect(result.canSubmit).toBe(false);
  });

  it('allows exactly R$ 300.00', () => {
    const result = calculateOrder(order([line('Q', 1)]), products, minimum);
    expect(result.blockers).toEqual([]);
    expect(result.canSubmit).toBe(true);
  });

  it('is measured after the discounts', () => {
    // 300.00 gross, 1% off -> 297.00
    const result = calculateOrder(order([line('Q', 1, { discountBp: 100 })]), products, minimum);
    expect(result.totalCents).toBe(29_700);
    expect(result.blockers).toContain('BELOW_MINIMUM');
  });

  it('is measured after the order discount too', () => {
    const result = calculateOrder(order([line('Q', 1)], 100), products, minimum);
    expect(result.totalCents).toBe(29_700);
    expect(result.blockers).toContain('BELOW_MINIMUM');
  });

  it('does not add BELOW_MINIMUM to an empty order', () => {
    const result = calculateOrder(order([]), products, minimum);
    expect(result.blockers).toEqual(['EMPTY_ORDER']);
  });
});

describe('discount limit (alçada)', () => {
  const products = catalog(product({ productId: 'P', unitPriceCents: 100_000 }), product({ productId: 'Q', unitPriceCents: 100_000 }));

  it('sends the order as submitted when the discount is exactly the limit', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 500 })]), products, policy());
    expect(result.status).toBe('SUBMITTED');
    expect(result.approvalReasons).toEqual([]);
  });

  it('sends it for approval one basis point above the limit', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 501 })]), products, policy());
    expect(result.status).toBe('AWAITING_APPROVAL');
    expect(result.approvalReasons).toEqual([{ code: 'LINE_DISCOUNT_ABOVE_LIMIT', productId: 'P', discountBp: 501 }]);
    expect(result.canSubmit).toBe(true);
  });

  it('checks the order discount against the limit, separately from the lines', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 500 })], 600), products, policy());
    expect(result.status).toBe('AWAITING_APPROVAL');
    expect(result.approvalReasons).toEqual([{ code: 'ORDER_DISCOUNT_ABOVE_LIMIT', discountBp: 600 }]);
  });

  it('does not add the line and order discounts together', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 500 })], 500), products, policy());
    expect(result.status).toBe('SUBMITTED');
  });

  it('lists every line over the limit', () => {
    const result = calculateOrder(
      order([line('P', 1, { discountBp: 600 }), line('Q', 1, { discountBp: 700 })]),
      products,
      policy(),
    );
    expect(result.approvalReasons.map((r) => r.code)).toEqual(['LINE_DISCOUNT_ABOVE_LIMIT', 'LINE_DISCOUNT_ABOVE_LIMIT']);
  });

  it('caps a generous seller at the global maximum', () => {
    const generous = policy({ sellerDiscountLimitBp: 700, maxDiscountBp: 500 });
    const result = calculateOrder(order([line('P', 1, { discountBp: 600 })]), products, generous);
    expect(result.effectiveDiscountLimitBp).toBe(500);
    expect(result.status).toBe('AWAITING_APPROVAL');
  });

  it('keeps a strict seller at their own limit when it is below the global maximum', () => {
    const strict = policy({ sellerDiscountLimitBp: 300, maxDiscountBp: 500 });
    const result = calculateOrder(order([line('P', 1, { discountBp: 400 })]), products, strict);
    expect(result.effectiveDiscountLimitBp).toBe(300);
    expect(result.status).toBe('AWAITING_APPROVAL');
  });

  it('applies the discount to the price: 5% off 1000.00 is 950.00', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 500 })]), products, policy());
    expect(result.lines[0].netCents).toBe(95_000);
  });
});

describe('quantity and packs', () => {
  const products = catalog(
    product({ productId: 'UNIT', packFactor: 1 }),
    product({ productId: 'LOOSE', packFactor: 20, multipleOnly: false }),
    product({ productId: 'PACKED', packFactor: 12, multipleOnly: true, unitPriceCents: 500 }),
  );

  it('prices a pack as pack factor times the unit price', () => {
    const result = calculateOrder(order([line('PACKED', 2, { unit: 'PACK' })]), products, policy());
    expect(result.lines[0]).toMatchObject({ quantityUnits: 24, grossCents: 12_000, netCents: 12_000, blockers: [] });
  });

  it('accepts units that are a multiple of the pack for a pack-only product', () => {
    const result = calculateOrder(order([line('PACKED', 36)]), products, policy());
    expect(result.lines[0].blockers).toEqual([]);
  });

  it('blocks units that are not a multiple of the pack for a pack-only product', () => {
    const result = calculateOrder(order([line('PACKED', 13)]), products, policy());
    expect(result.lines[0].blockers).toEqual(['NOT_PACK_MULTIPLE']);
    expect(result.canSubmit).toBe(false);
  });

  it('accepts any unit quantity when the product does not require packs', () => {
    const result = calculateOrder(order([line('LOOSE', 7)]), products, policy());
    expect(result.lines[0]).toMatchObject({ quantityUnits: 7, blockers: [] });
  });

  it('lets a product that is not pack-only be bought by the pack', () => {
    const result = calculateOrder(order([line('LOOSE', 1, { unit: 'PACK' })]), products, policy());
    expect(result.lines[0].quantityUnits).toBe(20);
  });

  it('blocks a pack of a product sold only by the unit', () => {
    const result = calculateOrder(order([line('UNIT', 1, { unit: 'PACK' })]), products, policy());
    expect(result.lines[0].blockers).toEqual(['PACK_NOT_AVAILABLE']);
  });

  it.each([0, -3, 1.5, Number.NaN])('blocks the invalid quantity %s', (quantity) => {
    const result = calculateOrder(order([line('UNIT', quantity)]), products, policy());
    expect(result.lines[0].blockers).toContain('INVALID_QUANTITY');
    expect(result.lines[0].netCents).toBeNull();
  });

  it('blocks an absurdly large quantity', () => {
    const result = calculateOrder(order([line('UNIT', 1_000_000)]), products, policy());
    expect(result.lines[0].blockers).toContain('INVALID_QUANTITY');
  });
});

describe('products that cannot be sold', () => {
  const products = catalog(
    product({ productId: 'GONE', active: false }),
    product({ productId: 'NOPRICE', hasPrice: false, unitPriceCents: 0 }),
    product({ productId: 'OK' }),
  );

  it('blocks an unknown product', () => {
    const result = calculateOrder(order([line('NOPE', 1)]), products, policy());
    expect(result.lines[0].blockers).toEqual(['UNKNOWN_PRODUCT']);
  });

  it('blocks an inactive product and shows no price for it', () => {
    const result = calculateOrder(order([line('GONE', 1)]), products, policy());
    expect(result.lines[0]).toMatchObject({ blockers: ['PRODUCT_INACTIVE'], unitPriceCents: null, netCents: null });
  });

  it('blocks a product missing from the price table', () => {
    const result = calculateOrder(order([line('NOPRICE', 1)]), products, policy());
    expect(result.lines[0]).toMatchObject({ blockers: ['NO_PRICE'], unitPriceCents: null });
  });

  it('leaves the blocked line out of the total', () => {
    const result = calculateOrder(order([line('OK', 2), line('GONE', 5)]), products, policy());
    expect(result.totalCents).toBe(2000);
    expect(result.canSubmit).toBe(false);
  });
});

describe('structure of the order', () => {
  const products = catalog(product({ productId: 'P' }), product({ productId: 'Q' }));

  it('blocks an empty order', () => {
    const result = calculateOrder(order([]), products, policy());
    expect(result).toMatchObject({ blockers: ['EMPTY_ORDER'], canSubmit: false, totalCents: 0 });
  });

  it('blocks the product that appears on two lines, on both lines', () => {
    const result = calculateOrder(order([line('P', 1), line('P', 2), line('Q', 1)]), products, policy());
    expect(result.lines.map((l) => l.blockers)).toEqual([['DUPLICATE_PRODUCT'], ['DUPLICATE_PRODUCT'], []]);
    expect(result.canSubmit).toBe(false);
  });

  it.each([-1, 10_001, 2.5])('blocks the invalid line discount %s', (discountBp) => {
    const result = calculateOrder(order([line('P', 1, { discountBp })]), products, policy());
    expect(result.lines[0].blockers).toContain('INVALID_DISCOUNT');
    expect(result.approvalReasons).toEqual([]);
  });

  it.each([-1, 10_001, 0.5])('blocks the invalid order discount %s', (orderDiscountBp) => {
    const result = calculateOrder(order([line('P', 1)], orderDiscountBp), products, policy());
    expect(result.blockers).toContain('INVALID_ORDER_DISCOUNT');
    expect(result.orderDiscountCents).toBe(0);
  });

  it('allows a 100% discount, but only through approval', () => {
    const result = calculateOrder(order([line('P', 1, { discountBp: 10_000 })]), products, policy());
    expect(result.lines[0].netCents).toBe(0);
    expect(result.status).toBe('AWAITING_APPROVAL');
  });
});

describe('a clean order', () => {
  it('can be submitted and goes out as submitted', () => {
    const products = catalog(product({ productId: 'P', unitPriceCents: 40_000 }));
    const result = calculateOrder(order([line('P', 1)]), products, policy({ minimumOrderCents: 30_000 }));
    expect(result).toMatchObject({ canSubmit: true, status: 'SUBMITTED', blockers: [], totalCents: 40_000 });
  });
});

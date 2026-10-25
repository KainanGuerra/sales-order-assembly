import { describe, expect, it } from 'vitest';
import { buildRepeatDraft, type CurrentProduct, type PastLine } from './repeat-order.js';

const product = (overrides: Partial<CurrentProduct> & { productId: string }): CurrentProduct => ({
  sku: `SKU-${overrides.productId}`,
  description: `Today ${overrides.productId}`,
  active: true,
  hasPrice: true,
  packFactor: 1,
  multipleOnly: false,
  ...overrides,
});
const line = (productId: string, quantityInput: number, unit: PastLine['unit'] = 'UNIT'): PastLine => ({
  productId,
  description: `Then ${productId}`,
  unit,
  quantityInput,
});
const catalog = (...products: CurrentProduct[]) => new Map(products.map((p) => [p.productId, p]));

describe('buildRepeatDraft', () => {
  it('copies the products, the quantities and the unit as they were entered', () => {
    const { items, skipped } = buildRepeatDraft([line('P1', 12), line('P2', 3, 'PACK')], catalog(product({ productId: 'P1' }), product({ productId: 'P2', packFactor: 12, multipleOnly: true })));
    expect(skipped).toEqual([]);
    expect(items.map((i) => [i.productId, i.quantity, i.unit])).toEqual([
      ['P1', 12, 'UNIT'],
      ['P2', 3, 'PACK'],
    ]);
  });

  it('resets every discount to zero', () => {
    const { items } = buildRepeatDraft([line('P1', 1)], catalog(product({ productId: 'P1' })));
    expect(items[0].discountBp).toBe(0);
  });

  it("describes a product the way the catalog does today, with today's pack rules", () => {
    const { items } = buildRepeatDraft([line('P1', 24)], catalog(product({ productId: 'P1', description: 'New name', packFactor: 12, multipleOnly: true })));
    expect(items[0]).toMatchObject({ description: 'New name', packFactor: 12, multipleOnly: true, sku: 'SKU-P1' });
  });

  it('skips a discontinued product, with the reason', () => {
    const { items, skipped } = buildRepeatDraft([line('P1', 1), line('P2', 1)], catalog(product({ productId: 'P1', active: false }), product({ productId: 'P2' })));
    expect(items.map((i) => i.productId)).toEqual(['P2']);
    expect(skipped).toEqual([{ productId: 'P1', description: 'Today P1', reason: 'DISCONTINUED' }]);
  });

  it('skips a product that has no price in the client\'s table', () => {
    const { skipped } = buildRepeatDraft([line('P1', 1)], catalog(product({ productId: 'P1', hasPrice: false })));
    expect(skipped).toEqual([{ productId: 'P1', description: 'Today P1', reason: 'NO_PRICE_IN_TABLE' }]);
  });

  it('skips a product the catalog no longer knows, using the old description', () => {
    const { skipped } = buildRepeatDraft([line('P9', 1)], catalog());
    expect(skipped).toEqual([{ productId: 'P9', description: 'Then P9', reason: 'UNKNOWN_PRODUCT' }]);
  });

  it('checks inactive before price: a discontinued product without a price is "discontinued"', () => {
    const { skipped } = buildRepeatDraft([line('P1', 1)], catalog(product({ productId: 'P1', active: false, hasPrice: false })));
    expect(skipped[0].reason).toBe('DISCONTINUED');
  });

  it('copes with an order where nothing can be repeated', () => {
    const { items, skipped } = buildRepeatDraft([line('P1', 1), line('P2', 1)], catalog());
    expect(items).toEqual([]);
    expect(skipped).toHaveLength(2);
  });

  it('keeps the order of the lines', () => {
    const { items } = buildRepeatDraft([line('P3', 1), line('P1', 1), line('P2', 1)], catalog(product({ productId: 'P1' }), product({ productId: 'P2' }), product({ productId: 'P3' })));
    expect(items.map((i) => i.productId)).toEqual(['P3', 'P1', 'P2']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { ProductsRepository } from '../repository/products.repository.js';
import type { ProductRow } from '../search-rules.js';
import { ProductsService } from './products.service.js';

const row = (overrides: Partial<ProductRow>): ProductRow => ({
  id: 'P001',
  sku: 'SKU-1000',
  ean: '7891958224128',
  description: 'Arroz Branco Tipo 1 5kg',
  saleUnit: 'UN',
  packFactor: 1,
  multipleOnly: false,
  active: true,
  unitPriceCents: 2690,
  ...overrides,
});

function build(rows: ProductRow[], showUnavailable = true) {
  const repository = { search: vi.fn().mockResolvedValue(rows), findByIds: vi.fn().mockResolvedValue(rows) };
  const env = { SHOW_UNAVAILABLE_PRODUCTS: showUnavailable } as Env;
  return { service: new ProductsService(repository as unknown as ProductsRepository, env), repository };
}

describe('ProductsService.search', () => {
  it('returns an available product with its unit price', async () => {
    const { service } = build([row({})]);
    const [item] = await service.search({ q: 'arroz', priceTableId: 'TP01', limit: 20 });
    expect(item).toMatchObject({ id: 'P001', availability: 'AVAILABLE', unitPriceCents: 2690, reason: null });
  });

  it('shows an active product without a price as disabled, with the reason, when the flag is on', async () => {
    const { service } = build([row({ unitPriceCents: null })], true);
    const [item] = await service.search({ q: 'arroz', priceTableId: 'TP03', limit: 20 });
    expect(item).toMatchObject({ availability: 'NO_PRICE', unitPriceCents: null, reason: 'NO_PRICE_IN_TABLE' });
  });

  it('hides an active product without a price when the flag is off', async () => {
    const { service } = build([row({ unitPriceCents: null })], false);
    expect(await service.search({ q: 'arroz', priceTableId: 'TP03', limit: 20 })).toEqual([]);
  });

  it('hides an inactive product from a text search', async () => {
    const { service } = build([row({ active: false })]);
    expect(await service.search({ q: 'refrigerante', priceTableId: 'TP01', limit: 20 })).toEqual([]);
  });

  it('shows an inactive product on an exact EAN match, without a price', async () => {
    const { service } = build([row({ active: false, ean: '7891853290372' })]);
    const [item] = await service.search({ q: '7891853290372', priceTableId: 'TP01', limit: 20 });
    expect(item).toMatchObject({ availability: 'INACTIVE', unitPriceCents: null, reason: 'DISCONTINUED' });
  });

  it('does not show an inactive product when the typed code belongs to another product', async () => {
    const { service } = build([row({ active: false, ean: '7891853290372', sku: 'SKU-1020' })]);
    expect(await service.search({ q: '7891958224128', priceTableId: 'TP01', limit: 20 })).toEqual([]);
  });

  it('cuts the page after filtering what is hidden', async () => {
    const hidden = row({ id: 'P090', active: false });
    const visible = [row({ id: 'P001' }), row({ id: 'P002' }), row({ id: 'P003' })];
    const { service } = build([hidden, ...visible]);
    const items = await service.search({ q: 'x', priceTableId: 'TP01', limit: 2 });
    expect(items.map((i) => i.id)).toEqual(['P001', 'P002']);
  });
});

describe('ProductsService.findQuotes', () => {
  it('lists the ids it could not find', async () => {
    const { service } = build([row({ id: 'P001' })]);
    const result = await service.findQuotes(['P001', 'P999'], 'TP01');
    expect(result.unknownProductIds).toEqual(['P999']);
    expect(result.products).toHaveLength(1);
  });
});

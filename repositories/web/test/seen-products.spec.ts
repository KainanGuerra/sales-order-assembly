import { describe, expect, it } from 'vitest';
import { remember, searchSeen } from '../app/utils/seen-products';
import type { ProductSearchItem } from '../app/types/api';

const product = (id: string, description: string, extra: Partial<ProductSearchItem> = {}): ProductSearchItem => ({
  id,
  sku: `SKU-${id}`,
  ean: `789000000${id.padStart(4, '0')}`,
  description,
  saleUnit: 'UN',
  packFactor: 1,
  multipleOnly: false,
  availability: 'AVAILABLE',
  unitPriceCents: 1000,
  reason: null,
  ...extra,
});

describe('remember', () => {
  it('puts the newest sightings first', () => {
    const seen = remember([product('1', 'Arroz')], [product('2', 'Feijão')]);
    expect(seen.map((p) => p.id)).toEqual(['2', '1']);
  });

  it('replaces an older copy of the same product, so the price is the latest seen', () => {
    const seen = remember([product('1', 'Arroz', { unitPriceCents: 1000 })], [product('1', 'Arroz', { unitPriceCents: 1200 })]);
    expect(seen).toHaveLength(1);
    expect(seen[0].unitPriceCents).toBe(1200);
  });

  it('does not keep a discontinued product', () => {
    expect(remember([], [product('1', 'Arroz', { availability: 'INACTIVE' })])).toEqual([]);
  });

  it('keeps at most 300 products per client, dropping the oldest', () => {
    const many = Array.from({ length: 305 }, (_, i) => product(String(i), `Produto ${i}`));
    const seen = remember([], many);
    expect(seen).toHaveLength(300);
    expect(seen[0].id).toBe('0');
  });
});

describe('searchSeen', () => {
  const seen = [product('1', 'Açúcar Cristal 1kg'), product('2', 'Arroz Branco 5kg'), product('3', 'Feijão Carioca 1kg')];

  it('finds the typed text inside the name, ignoring accents and case', () => {
    expect(searchSeen(seen, 'ACUCAR').map((p) => p.id)).toEqual(['1']);
    expect(searchSeen(seen, 'feijao').map((p) => p.id)).toEqual(['3']);
    expect(searchSeen(seen, '1kg').map((p) => p.id)).toEqual(['1', '3']);
  });

  it('needs at least two characters', () => {
    expect(searchSeen(seen, 'a')).toEqual([]);
    expect(searchSeen(seen, '  ')).toEqual([]);
  });

  it('finds an exact EAN or SKU, but not part of one', () => {
    expect(searchSeen(seen, seen[1].ean).map((p) => p.id)).toEqual(['2']);
    expect(searchSeen(seen, 'sku-3').map((p) => p.id)).toEqual(['3']);
    expect(searchSeen(seen, seen[1].ean.slice(0, 8))).toEqual([]);
  });

  it('does not tolerate typos (that is the server\'s search)', () => {
    expect(searchSeen(seen, 'feijaum')).toEqual([]);
  });

  it('shows at most 20 products', () => {
    const many = Array.from({ length: 30 }, (_, i) => product(String(i), `Biscoito ${i}`));
    expect(searchSeen(many, 'biscoito')).toHaveLength(20);
  });
});

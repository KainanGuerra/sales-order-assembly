import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapCatalogSeed, toCents } from './seed-mapper.js';

const product = {
  id: 'P001',
  sku: 'SKU-1000',
  ean: '7891958224128',
  descricao: 'Arroz Branco Tipo 1 5kg',
  categoria: 'mercearia',
  marca: 'Grão Fino',
  unidade_venda: 'UN',
  fator_embalagem: 1,
  venda_somente_multiplo: false,
  ativo: true,
};

describe('toCents', () => {
  it('absorbs float noise from the seed', () => {
    expect(toCents(26.9)).toBe(2690);
    expect(toCents(7.49)).toBe(749);
    expect(toCents(4.5)).toBe(450);
    expect(toCents(1.15)).toBe(115);
  });
});

describe('mapCatalogSeed', () => {
  it('maps products and prices to English fields and integer cents', () => {
    const result = mapCatalogSeed({
      produtos: [product],
      tabelas_preco: [{ id: 'TP01', nome: 'Tabela Padrão', itens: [{ produto_id: 'P001', preco_unidade: 26.9 }] }],
    });

    expect(result.products[0]).toMatchObject({ id: 'P001', description: 'Arroz Branco Tipo 1 5kg', packFactor: 1 });
    expect(result.priceItems).toEqual([{ priceTableId: 'TP01', productId: 'P001', unitPriceCents: 2690 }]);
  });

  it('rejects a price that points to an unknown product', () => {
    expect(() =>
      mapCatalogSeed({
        produtos: [product],
        tabelas_preco: [{ id: 'TP01', nome: 'x', itens: [{ produto_id: 'P999', preco_unidade: 1 }] }],
      }),
    ).toThrow(/unknown product P999/);
  });

  it('rejects a product with a malformed field', () => {
    expect(() =>
      mapCatalogSeed({ produtos: [{ ...product, fator_embalagem: 0 }], tabelas_preco: [] }),
    ).toThrow();
  });

  // The real file keeps its imperfections; the mapper must accept it as is.
  it('accepts the delivered seed.json, duplicate EAN and all', () => {
    const file = new URL('../../../../../seed.json', import.meta.url);
    const result = mapCatalogSeed(JSON.parse(readFileSync(file, 'utf8')));

    expect(result.products).toHaveLength(23);
    expect(result.priceTables).toHaveLength(3);
    expect(result.products.filter((p) => p.ean === '7891831978575').map((p) => p.id)).toEqual(['P009', 'P023']);
    // TP03 has no price for the discontinued P021.
    expect(result.priceItems.some((i) => i.priceTableId === 'TP03' && i.productId === 'P021')).toBe(false);
  });
});

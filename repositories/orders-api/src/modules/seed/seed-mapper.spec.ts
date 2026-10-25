import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deterministicUuid, mapHistoryOrders } from './seed-mapper.js';

const seed = (overrides: Record<string, unknown> = {}) => ({
  vendedores: [{ id: 'V01', nome: 'Carlos Menezes', supervisor_id: 'S01' }],
  clientes: [{ id: 'C001', nome_fantasia: 'Mercadinho São José', tabela_preco_id: 'TP01' }],
  produtos: [{ id: 'P001', sku: 'SKU-1000', descricao: 'Arroz Branco Tipo 1 5kg', fator_embalagem: 1 }],
  pedidos_historico: [
    {
      id: 'PH001', cliente_id: 'C001', vendedor_id: 'V01', data: '2026-09-15', status: 'Faturado',
      itens: [{ produto_id: 'P001', quantidade: 10, preco_unidade: 25.9, desconto_percentual: 2 }],
    },
  ],
  ...overrides,
});

describe('deterministicUuid', () => {
  it('is the same every time, so an import can run twice', () => {
    expect(deterministicUuid('PH001')).toBe(deterministicUuid('PH001'));
  });

  it('differs between ids and is a valid version 5 UUID', () => {
    expect(deterministicUuid('PH001')).not.toBe(deterministicUuid('PH002'));
    expect(deterministicUuid('PH001')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('mapHistoryOrders', () => {
  it('maps the seed words to our statuses: Faturado is INVOICED and Cancelado is CANCELLED', () => {
    const [faturado] = mapHistoryOrders(seed(), 'TP01');
    expect(faturado.order.status).toBe('INVOICED');
    const cancelled = seed({ pedidos_historico: [{ ...seed().pedidos_historico[0], status: 'Cancelado' }] });
    expect(mapHistoryOrders(cancelled, 'TP01')[0].order.status).toBe('CANCELLED');
  });

  it('marks the orders as imported, with the names and the supervisor taken from the file', () => {
    const [imported] = mapHistoryOrders(seed(), 'TP01');
    expect(imported.order).toMatchObject({ origin: 'IMPORTED', sellerName: 'Carlos Menezes', supervisorId: 'S01', clientTradeName: 'Mercadinho São José' });
  });

  it('converts prices to cents and applies the discount to each line once, half up', () => {
    const [imported] = mapHistoryOrders(seed(), 'TP01');
    // 10 x 25,90 = 259,00; 2% off = 253,82
    expect(imported.items[0]).toMatchObject({ unitPriceCents: 2590, discountBp: 200, grossCents: 25_900, netCents: 25_382, quantityUnits: 10, unit: 'UNIT' });
    expect(imported.order).toMatchObject({ subtotalCents: 25_382, totalCents: 25_382, orderDiscountCents: 0 });
  });

  it('records a single history step at the order date, by the import', () => {
    const [imported] = mapHistoryOrders(seed(), 'TP01');
    expect(imported.history).toEqual({ status: 'INVOICED', actor: 'system:import', createdAt: new Date('2026-09-15T12:00:00.000Z') });
  });

  it('uses the default table for a client that has none', () => {
    const noTable = seed({ clientes: [{ id: 'C001', nome_fantasia: 'X', tabela_preco_id: null }] });
    expect(mapHistoryOrders(noTable, 'TP01')[0].order.priceTableId).toBe('TP01');
  });

  it('refuses a status it does not know, and a reference to something missing', () => {
    expect(() => mapHistoryOrders(seed({ pedidos_historico: [{ ...seed().pedidos_historico[0], status: 'Pendente' }] }), 'TP01')).toThrow(/unknown status/);
    expect(() => mapHistoryOrders(seed({ clientes: [] }), 'TP01')).toThrow(/unknown seller or client/);
    expect(() => mapHistoryOrders(seed({ produtos: [] }), 'TP01')).toThrow(/unknown product/);
  });

  it('accepts the delivered seed.json: four orders, three invoiced and one cancelled', () => {
    const file = new URL('../../../../../seed.json', import.meta.url);
    const orders = mapHistoryOrders(JSON.parse(readFileSync(file, 'utf8')), 'TP01');
    expect(orders).toHaveLength(4);
    expect(orders.map((o) => o.order.status)).toEqual(['INVOICED', 'INVOICED', 'INVOICED', 'CANCELLED']);
    // PH003 is for the client with the unpriced, discontinued P021: it is imported as it was.
    expect(orders[2].items.map((i) => i.productId)).toContain('P021');
    expect(new Set(orders.map((o) => o.order.id)).size).toBe(4);
  });
});

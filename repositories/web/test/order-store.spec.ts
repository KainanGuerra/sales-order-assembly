import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useOrderStore } from '../app/stores/order';
import type { ProductSearchItem } from '../app/types/api';

const product = (overrides: Partial<ProductSearchItem> & { id: string }): ProductSearchItem => ({
  sku: `SKU-${overrides.id}`,
  ean: '7890000000000',
  description: `Product ${overrides.id}`,
  saleUnit: 'UN',
  packFactor: 1,
  multipleOnly: false,
  availability: 'AVAILABLE',
  unitPriceCents: 1000,
  reason: null,
  ...overrides,
});

describe('order store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts empty, with an order id ready', () => {
    const order = useOrderStore();
    expect(order.isEmpty).toBe(true);
    expect(order.orderId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('adds a loose product as one unit', () => {
    const order = useOrderStore();
    order.addProduct(product({ id: 'P1' }));
    expect(order.lines[0]).toMatchObject({ productId: 'P1', unit: 'UNIT', quantity: 1, discountBp: 0 });
  });

  it('adds a pack-only product as one pack', () => {
    const order = useOrderStore();
    order.addProduct(product({ id: 'P2', packFactor: 12, multipleOnly: true }));
    expect(order.lines[0]).toMatchObject({ unit: 'PACK', quantity: 1, packFactor: 12 });
  });

  it('adds a pack product that is not pack-only as one unit', () => {
    const order = useOrderStore();
    order.addProduct(product({ id: 'P3', packFactor: 20, multipleOnly: false }));
    expect(order.lines[0].unit).toBe('UNIT');
  });

  it('does not add the same product twice', () => {
    const order = useOrderStore();
    order.addProduct(product({ id: 'P1' }));
    order.setQuantity('P1', 7);
    order.addProduct(product({ id: 'P1' }));
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0].quantity).toBe(7);
  });

  it('edits the quantity, unit and discounts, and removes a line', () => {
    const order = useOrderStore();
    order.addProduct(product({ id: 'P1', packFactor: 12 }));
    order.addProduct(product({ id: 'P2' }));
    order.setQuantity('P1', 3);
    order.setUnit('P1', 'PACK');
    order.setLineDiscount('P1', 250);
    order.setOrderDiscount(100);
    order.removeLine('P2');
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({ quantity: 3, unit: 'PACK', discountBp: 250 });
    expect(order.orderDiscountBp).toBe(100);
  });

  it('builds the calculation request from what was typed, and nothing computed', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P1' }));
    order.setQuantity('P1', 12);
    order.setOrderDiscount(200);
    expect(order.request).toEqual({
      clientId: 'C001',
      items: [{ productId: 'P1', quantity: 12, unit: 'UNIT', discountBp: 0 }],
      orderDiscountBp: 200,
    });
  });

  it('keeps the draft when the same client is opened again', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P1' }));
    order.start('C001');
    expect(order.lines).toHaveLength(1);
  });

  it('starts a new order, with a new id, when another client is opened', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P1' }));
    const first = order.orderId;
    order.start('C002');
    expect(order.lines).toEqual([]);
    expect(order.clientId).toBe('C002');
    expect(order.orderId).not.toBe(first);
  });

  it('gives the next order a new id after a reset', () => {
    const order = useOrderStore();
    const first = order.orderId;
    order.reset();
    expect(order.orderId).not.toBe(first);
  });

  it('restores a saved draft, keeping its order id', () => {
    const order = useOrderStore();
    order.restore({ clientId: 'C001', lines: [], orderDiscountBp: 300, orderId: 'saved-id' });
    expect(order).toMatchObject({ clientId: 'C001', orderDiscountBp: 300, orderId: 'saved-id' });
  });

  it('restores from an empty or partial draft without breaking', () => {
    const order = useOrderStore();
    order.restore({});
    expect(order.clientId).toBeNull();
    expect(order.lines).toEqual([]);
  });

  it('becomes a copy of an old order: its products, quantities and units, discounts at zero, a new id', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P9' }));
    order.setOrderDiscount(300);
    const before = order.orderId;
    order.replaceWith('C002', [
      { productId: 'P1', description: 'Product P1', sku: 'SKU-P1', packFactor: 1, multipleOnly: false, unit: 'UNIT', quantity: 12 },
      { productId: 'P2', description: 'Product P2', sku: 'SKU-P2', packFactor: 12, multipleOnly: true, unit: 'PACK', quantity: 3 },
    ]);
    expect(order.clientId).toBe('C002');
    expect(order.lines.map((l) => [l.productId, l.quantity, l.unit, l.discountBp])).toEqual([
      ['P1', 12, 'UNIT', 0],
      ['P2', 3, 'PACK', 0],
    ]);
    expect(order.orderDiscountBp).toBe(0);
    expect(order.orderId).not.toBe(before);
  });

  it('keeps a repeated order when its own client is opened next', () => {
    const order = useOrderStore();
    order.replaceWith('C001', [{ productId: 'P1', description: 'Product P1', sku: 'SKU-P1', packFactor: 1, multipleOnly: false, unit: 'UNIT', quantity: 5 }]);
    order.start('C001');
    expect(order.lines).toHaveLength(1);
  });
  it('brings a refused queued order back with its discounts and a new id', () => {
    const order = useOrderStore();
    const before = order.orderId;
    const line = { productId: 'P1', description: 'Arroz', sku: 'SKU-1', packFactor: 1, multipleOnly: false, unit: 'UNIT' as const, quantity: 10, discountBp: 300 };
    order.loadForFixing('C001', [line], 200);
    expect(order.clientId).toBe('C001');
    expect(order.lines).toEqual([line]);
    expect(order.orderDiscountBp).toBe(200);
    expect(order.orderId).not.toBe(before);
    // A copy: editing the order must not change the queued one.
    order.setQuantity('P1', 99);
    expect(line.quantity).toBe(10);
  });

  it('is not in conflict when the draft is empty, even if it belongs to another client', () => {
    const order = useOrderStore();
    order.start('C001');
    expect(order.conflictsWith('C002')).toBe(false);
  });

  it('is not in conflict with the client the draft already belongs to', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P1' }));
    expect(order.conflictsWith('C001')).toBe(false);
  });

  it('is in conflict when the draft has items for another client', () => {
    const order = useOrderStore();
    order.start('C001');
    order.addProduct(product({ id: 'P1' }));
    expect(order.conflictsWith('C002')).toBe(true);
  });
});

import { defineStore } from 'pinia';
import type { ProductSearchItem, QuantityUnit } from '~/types/api';

// The order being built. Only what the seller typed lives here: the products,
// quantities and discounts. Totals, blocking reasons and the status are never
// computed on this side; they come from the backend for every change.

export interface DraftLine {
  productId: string;
  description: string;
  sku: string;
  packFactor: number;
  multipleOnly: boolean;
  unit: QuantityUnit;
  quantity: number;
  discountBp: number;
}

export interface DraftState {
  clientId: string | null;
  lines: DraftLine[];
  orderDiscountBp: number;
  // Generated once per order and sent with it, so sending twice is safe.
  orderId: string;
}

const newOrderId = () => crypto.randomUUID();

export const useOrderStore = defineStore('order', {
  state: (): DraftState => ({ clientId: null, lines: [], orderDiscountBp: 0, orderId: newOrderId() }),

  getters: {
    isEmpty: (state) => state.lines.length === 0,
    // The body of a calculation request.
    request: (state) => ({
      clientId: state.clientId ?? '',
      items: state.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unit: l.unit,
        discountBp: l.discountBp,
      })),
      orderDiscountBp: state.orderDiscountBp,
    }),
  },

  actions: {
    // Opening another client starts another order; coming back to the same one
    // keeps the draft.
    start(clientId: string) {
      if (this.clientId !== clientId) {
        this.reset();
        this.clientId = clientId;
      }
    },

    // A product already on the order is not added twice: the seller edits its
    // quantity. A pack-only product starts at one pack, anything else at one unit.
    addProduct(product: ProductSearchItem) {
      if (this.lines.some((l) => l.productId === product.id)) {
        return;
      }
      const byPack = product.multipleOnly && product.packFactor > 1;
      this.lines.push({
        productId: product.id,
        description: product.description,
        sku: product.sku,
        packFactor: product.packFactor,
        multipleOnly: product.multipleOnly,
        unit: byPack ? 'PACK' : 'UNIT',
        quantity: 1,
        discountBp: 0,
      });
    },

    // The order being built becomes a copy of an old one (see RepeatDraft). It is
    // a new order, so it gets its own id; the discounts start at zero.
    replaceWith(
      clientId: string,
      items: Pick<DraftLine, 'productId' | 'description' | 'sku' | 'packFactor' | 'multipleOnly' | 'unit' | 'quantity'>[],
    ) {
      this.clientId = clientId;
      this.lines = items.map((item) => ({ ...item, discountBp: 0 }));
      this.orderDiscountBp = 0;
      this.orderId = newOrderId();
    },

    removeLine(productId: string) {
      this.lines = this.lines.filter((l) => l.productId !== productId);
    },

    setQuantity(productId: string, quantity: number) {
      const line = this.lines.find((l) => l.productId === productId);
      if (line) {
        line.quantity = quantity;
      }
    },

    setUnit(productId: string, unit: QuantityUnit) {
      const line = this.lines.find((l) => l.productId === productId);
      if (line) {
        line.unit = unit;
      }
    },

    setLineDiscount(productId: string, discountBp: number) {
      const line = this.lines.find((l) => l.productId === productId);
      if (line) {
        line.discountBp = discountBp;
      }
    },

    setOrderDiscount(discountBp: number) {
      this.orderDiscountBp = discountBp;
    },

    // After the order was sent: the next one gets a new id.
    reset() {
      this.clientId = null;
      this.lines = [];
      this.orderDiscountBp = 0;
      this.orderId = newOrderId();
    },

    restore(saved: Partial<DraftState>) {
      this.clientId = saved.clientId ?? null;
      this.lines = saved.lines ?? [];
      this.orderDiscountBp = saved.orderDiscountBp ?? 0;
      this.orderId = saved.orderId ?? newOrderId();
    },
  },
});

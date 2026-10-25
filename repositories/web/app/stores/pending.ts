import { defineStore } from 'pinia';
import type { Calculation, OrderView } from '~/types/api';
import { calculationOf, classifyFailure, type Failure } from '~/utils/connectivity';
import type { DraftLine } from './order';

// Orders the seller closed without signal. Each waits on the phone, with the
// same order id it will be sent with, until the server accepts or refuses it.
// Nothing here is a rule: whether an order can go out is decided by the server
// when it arrives.

export interface QueuedOrder {
  orderId: string;
  // Whose order it is: another seller on the same phone never sees or sends it.
  sellerId: string;
  clientId: string;
  clientName: string;
  lines: DraftLine[];
  orderDiscountBp: number;
  queuedAt: string;
  // WAITING: to be sent. REFUSED: the server said no; it stays until the seller fixes or discards it.
  state: 'WAITING' | 'REFUSED';
  // What the server answered when it refused (its reasons).
  calculation?: Calculation;
}

export type SyncResult =
  | { kind: 'SENT'; pending: QueuedOrder; order: OrderView }
  | { kind: 'REFUSED'; pending: QueuedOrder }
  // The sending stopped here and the order keeps waiting.
  | { kind: 'STOPPED'; pending: QueuedOrder; why: Exclude<Failure, 'REFUSED' | 'OTHER'> };

export const usePendingStore = defineStore('pending', {
  state: () => ({
    items: [] as QueuedOrder[],
    // Only one round of sending at a time (a timer and a "back online" event can coincide).
    sending: false,
  }),

  getters: {
    of: (state) => (sellerId: string) => state.items.filter((i) => i.sellerId === sellerId),
    waitingOf: (state) => (sellerId: string) => state.items.filter((i) => i.sellerId === sellerId && i.state === 'WAITING'),
  },

  actions: {
    add(order: Omit<QueuedOrder, 'state' | 'queuedAt'>) {
      // Queuing the same order twice (a double tap) keeps one.
      if (this.items.some((i) => i.orderId === order.orderId)) {
        return;
      }
      this.items.push({ ...order, state: 'WAITING', queuedAt: new Date().toISOString() });
    },

    remove(orderId: string) {
      this.items = this.items.filter((i) => i.orderId !== orderId);
    },

    refuse(orderId: string, calculation?: Calculation) {
      const item = this.items.find((i) => i.orderId === orderId);
      if (item) {
        item.state = 'REFUSED';
        item.calculation = calculation;
      }
    },

    restore(saved: QueuedOrder[]) {
      this.items = saved;
    },

    // Sends the seller's waiting orders, oldest first, one at a time. A refusal
    // is final for that order and the next one is tried; anything that only
    // means "not now" (no signal, server error, login ended) stops the round and
    // leaves everything waiting. Resending an order the server already saved is
    // harmless: the same id returns the saved order.
    async flush(sellerId: string, send: (order: QueuedOrder) => Promise<OrderView>): Promise<SyncResult[]> {
      if (this.sending) {
        return [];
      }
      this.sending = true;
      const results: SyncResult[] = [];
      try {
        for (const pending of this.waitingOf(sellerId)) {
          try {
            const order = await send(pending);
            this.remove(pending.orderId);
            results.push({ kind: 'SENT', pending, order });
          } catch (error) {
            const why = classifyFailure(error);
            if (why === 'REFUSED' || why === 'OTHER') {
              this.refuse(pending.orderId, calculationOf(error));
              results.push({ kind: 'REFUSED', pending });
              continue;
            }
            results.push({ kind: 'STOPPED', pending, why });
            break;
          }
        }
      } finally {
        this.sending = false;
      }
      return results;
    },
  },
});

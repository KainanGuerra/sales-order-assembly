import { defineStore } from 'pinia';
import type { ProductSearchItem } from '~/types/api';
import { remember, searchSeen } from '~/utils/seen-products';

// What the seller has already seen, per client (see utils/seen-products.ts).
// Emptied when a session starts or ends: it holds the prices of one person's clients.
export const useSeenProductsStore = defineStore('seen-products', {
  state: () => ({ byClient: {} as Record<string, ProductSearchItem[]> }),

  actions: {
    remember(clientId: string, found: ProductSearchItem[]) {
      this.byClient[clientId] = remember(this.byClient[clientId] ?? [], found);
    },
    search(clientId: string, text: string): ProductSearchItem[] {
      return searchSeen(this.byClient[clientId] ?? [], text);
    },
    restore(saved: Record<string, ProductSearchItem[]>) {
      this.byClient = saved;
    },
    clear() {
      this.byClient = {};
    },
  },
});

import { useOrderStore, type DraftState } from '~/stores/order';

const KEY = 'sales.order-draft';

// The draft survives a reload. Storage can be missing or full (private
// windows), so every access is guarded and the app works without it.
export default defineNuxtPlugin((nuxtApp) => {
  const store = useOrderStore(nuxtApp.$pinia);

  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      store.restore(JSON.parse(saved) as Partial<DraftState>);
    }
  } catch {
    // Unreadable draft: start with an empty one.
  }

  store.$subscribe((_mutation, state) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Not persisted; the draft still works in memory.
    }
  });
});

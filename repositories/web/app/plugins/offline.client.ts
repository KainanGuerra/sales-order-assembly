import { usePendingStore, type QueuedOrder } from '~/stores/pending';
import { useSeenProductsStore } from '~/stores/seen-products';
import type { ProductSearchItem } from '~/types/api';

const PENDING_KEY = 'sales.pending-orders';
const SEEN_KEY = 'sales.seen-products';
const PROBE_EVERY_MS = 5000;

// What must survive a reload or a closed tab: the orders waiting to be sent and
// the products already seen. Storage can be missing or full, so every access
// is guarded and the app still works from memory without it.
function keepInStorage<T>(key: string, read: () => T, write: (saved: T) => void, subscribe: (save: () => void) => void) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      write(JSON.parse(saved) as T);
    }
  } catch {
    // Unreadable: start empty.
  }
  subscribe(() => {
    try {
      localStorage.setItem(key, JSON.stringify(read()));
    } catch {
      // Not persisted; it still works in memory.
    }
  });
}

export default defineNuxtPlugin((nuxtApp) => {
  const pending = usePendingStore(nuxtApp.$pinia);
  const seen = useSeenProductsStore(nuxtApp.$pinia);

  keepInStorage<QueuedOrder[]>(PENDING_KEY, () => pending.items, (saved) => pending.restore(saved), (save) => pending.$subscribe(save));
  keepInStorage<Record<string, ProductSearchItem[]>>(SEEN_KEY, () => seen.byClient, (saved) => seen.restore(saved), (save) => seen.$subscribe(save));

  const { online, markOnline, markOffline } = useConnectivity();
  window.addEventListener('offline', markOffline);
  window.addEventListener('online', markOnline);
  if (!navigator.onLine) {
    markOffline();
  }

  // While offline, ask the server for something tiny now and then. The first
  // answer is what turns the app back online.
  setInterval(async () => {
    if (online.value) {
      return;
    }
    try {
      await $fetch('/api/health', { timeout: 4000 });
      markOnline();
    } catch {
      // Still no signal.
    }
  }, PROBE_EVERY_MS);
});

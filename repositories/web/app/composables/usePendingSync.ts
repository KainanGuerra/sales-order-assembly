import type { OrderView } from '~/types/api';
import { orderRequest } from '~/stores/order';
import { usePendingStore, type QueuedOrder, type SyncResult } from '~/stores/pending';

const RETRY_EVERY_MS = 15_000;

// Sends the logged-in seller's waiting orders (stores/pending.ts decides how
// each outcome is treated) and tells the seller what happened.
export function usePendingSync() {
  const pending = usePendingStore();
  const { user } = useSession();
  const api = useApi();
  const toast = useToast();
  const { t } = useI18n();

  const send = (p: QueuedOrder) =>
    api<OrderView>('/api/orders', { method: 'POST', body: { orderId: p.orderId, ...orderRequest(p.clientId, p.lines, p.orderDiscountBp) } });

  function announce(result: SyncResult) {
    const client = result.pending.clientName;
    if (result.kind === 'SENT') {
      toast.add({ title: t('pending.sent', { client, status: t(`order.status.${result.order.status}`) }), color: 'success', icon: 'i-lucide-send' });
    } else if (result.kind === 'REFUSED') {
      toast.add({ title: t('pending.refusedToast', { client }), color: 'error', icon: 'i-lucide-octagon-alert' });
    }
  }

  async function syncNow() {
    if (user.value?.role !== 'SELLER') {
      return;
    }
    (await pending.flush(user.value.id, send)).forEach(announce);
  }

  return { syncNow };
}

// Called once, by the layout: tries again when the signal comes back, when a
// seller logs in, and from time to time while something is waiting (a poor
// connection can answer "online" and still drop a request).
export function useAutoSync() {
  const pending = usePendingStore();
  const { user } = useSession();
  const { online } = useConnectivity();
  const { syncNow } = usePendingSync();

  watch([online, () => user.value?.id], ([isOnline]) => {
    if (isOnline) {
      void syncNow();
    }
  }, { immediate: true });

  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    timer = setInterval(() => {
      if (online.value && user.value && pending.waitingOf(user.value.id).length > 0) {
        void syncNow();
      }
    }, RETRY_EVERY_MS);
  });
  onBeforeUnmount(() => clearInterval(timer));
}

<script setup lang="ts">
import type { QueuedOrder } from '~/stores/pending';

// Orders closed without signal, for the logged-in seller: the ones waiting to
// be sent, and the ones the server refused (kept, with its reasons, until the
// seller fixes or discards them).
const { t } = useI18n();
const { user } = useSession();
const pending = usePendingStore();
const order = useOrderStore();
const { online } = useConnectivity();
const { syncNow } = usePendingSync();

const mine = computed(() => (user.value ? pending.of(user.value.id) : []));
const sendingNow = ref(false);

const descriptions = (item: QueuedOrder) => Object.fromEntries(item.lines.map((l) => [l.productId, l.description]));
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

async function sendNow() {
  sendingNow.value = true;
  try {
    await syncNow();
  } finally {
    sendingNow.value = false;
  }
}

// Fixing puts the order back in the editor; an order already in progress is
// not replaced without asking.
const fixing = ref<QueuedOrder | null>(null);
const confirmOpen = ref(false);

async function fix(item: QueuedOrder) {
  if (!order.isEmpty) {
    fixing.value = item;
    confirmOpen.value = true;
    return;
  }
  await apply(item);
}

async function apply(item: QueuedOrder) {
  order.loadForFixing(item.clientId, item.lines, item.orderDiscountBp);
  pending.remove(item.orderId);
  confirmOpen.value = false;
  fixing.value = null;
  await navigateTo(`/orders/new/${encodeURIComponent(item.clientId)}`);
}

// Discarding loses the work, so it takes a second tap.
const discarding = ref<string | null>(null);
function discard(item: QueuedOrder) {
  if (discarding.value !== item.orderId) {
    discarding.value = item.orderId;
    return;
  }
  pending.remove(item.orderId);
  discarding.value = null;
}
</script>

<template>
  <section v-if="mine.length" class="space-y-2" data-testid="pending-orders">
    <h2 class="font-medium">{{ t('pending.title') }}</h2>
    <UCard v-for="item in mine" :key="item.orderId" :data-testid="`pending-${item.orderId}`">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate font-medium">{{ item.clientName }}</p>
          <p class="text-sm text-neutral-500">{{ t('pending.items', { n: item.lines.length }) }} · {{ t('pending.savedAt', { time: time(item.queuedAt) }) }}</p>
          <UBadge v-if="item.state === 'WAITING'" color="warning" variant="subtle" size="sm" class="mt-1" data-testid="pending-waiting">{{ online ? t('pending.sendingSoon') : t('pending.waitingSignal') }}</UBadge>
          <UBadge v-else color="error" variant="subtle" size="sm" class="mt-1" data-testid="pending-refused">{{ t('pending.refused') }}</UBadge>
        </div>
        <div class="flex flex-col items-end gap-2">
          <template v-if="item.state === 'WAITING'">
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-send" :disabled="!online" :loading="sendingNow" :label="t('pending.sendNow')" data-testid="pending-send-now" @click="sendNow" />
          </template>
          <template v-else>
            <UButton size="sm" icon="i-lucide-pencil" :label="t('pending.fix')" data-testid="pending-fix" @click="fix(item)" />
          </template>
          <UButton size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" :label="discarding === item.orderId ? t('pending.confirmDiscard') : t('pending.discard')" data-testid="pending-discard" @click="discard(item)" />
        </div>
      </div>
      <div v-if="item.state === 'REFUSED'" class="mt-2">
        <BlockerList v-if="item.calculation" :calculation="item.calculation" :descriptions="descriptions(item)" />
        <p v-if="!item.calculation || !item.calculation.blockers.length" class="text-sm text-neutral-600">{{ t('pending.refusedGeneric') }}</p>
      </div>
    </UCard>

    <UModal v-model:open="confirmOpen" :title="t('repeat.confirmTitle')" :description="t('repeat.confirmBody')">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" :label="t('repeat.cancel')" @click="confirmOpen = false" />
          <UButton :label="t('repeat.confirm')" data-testid="pending-fix-confirm" @click="fixing && apply(fixing)" />
        </div>
      </template>
    </UModal>
  </section>
</template>

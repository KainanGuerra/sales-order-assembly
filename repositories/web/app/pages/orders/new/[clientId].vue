<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import type { ClientView, OrderView, SkippedLine } from '~/types/api';
import { classifyFailure } from '~/utils/connectivity';

const { t } = useI18n();
useHead({ title: t('order.title') });
const api = useApi();
const route = useRoute();
const clientId = computed(() => String(route.params.clientId));
const queryClient = useQueryClient();
const toast = useToast();
const { user } = useSession();
const pending = usePendingStore();
// Without signal the order is not sent: it is closed and kept on the phone.
const { online } = useConnectivity();
const queueMode = computed(() => !online.value);

const order = useOrderStore();
order.start(clientId.value);

const { data: client, error: clientError } = await useFetch<ClientView>(() => `/api/clients/${encodeURIComponent(clientId.value)}`, { $fetch: api });

// After "repeat order": what was left out, and a reminder about prices and discounts.
const skipped = useState<SkippedLine[]>('repeat-skipped', () => []);
const notice = useState<boolean>('repeat-notice', () => false);
const dismissRepeatNotice = () => {
  skipped.value = [];
  notice.value = false;
};

const text = ref('');
const search = useProductSearch(clientId, text);
const calculation = useCalculation();

const descriptions = computed(() => Object.fromEntries(order.lines.map((l) => [l.productId, l.description])));
const calculatedByProduct = computed(() => new Map((calculation.data.value?.lines ?? []).map((l) => [l.productId, l])));
const showCalculation = computed(() => !order.isEmpty && calculation.data.value);

// The Send button needs an answer for exactly what is on screen: the backend
// said it can be sent, and nothing changed since.
// Without signal there is no fresh answer to wait for: the server checks every
// rule when the order is finally sent.
const canSend = computed(() =>
  queueMode.value ? !order.isEmpty : !order.isEmpty && !!calculation.data.value?.canSubmit && !calculation.isStale.value,
);

// Order discount: text on screen, basis points in the store.
const orderDiscountText = ref(basisPointsToInput(order.orderDiscountBp));
const orderDiscountInvalid = ref(false);
watch(orderDiscountText, (value) => {
  const bp = parsePercentToBasisPoints(value);
  orderDiscountInvalid.value = bp === null;
  if (bp !== null) {
    order.setOrderDiscount(bp);
  }
});

const submitting = ref(false);
const submitProblem = ref<'refused' | 'failed' | null>(null);

// Closes the order without sending it: it waits on the phone, with the id it
// will be sent with, and the screen is ready for the next one.
async function queueOrder() {
  pending.add({
    orderId: order.orderId,
    sellerId: user.value?.id ?? '',
    clientId: clientId.value,
    clientName: client.value?.tradeName ?? clientId.value,
    // A plain copy: the reactive lines would change when the draft is reset.
    lines: JSON.parse(JSON.stringify(order.lines)),
    orderDiscountBp: order.orderDiscountBp,
  });
  order.reset();
  queryClient.removeQueries({ queryKey: ['calculate'] });
  toast.add({ title: t('pending.queued'), color: 'warning', icon: 'i-lucide-wifi-off' });
  await navigateTo('/clients');
}

async function send() {
  if (queueMode.value) {
    await queueOrder();
    return;
  }
  submitting.value = true;
  submitProblem.value = null;
  try {
    // The same order id is sent again if this is retried, so it is never saved twice.
    const created = await api<OrderView>('/api/orders', { method: 'POST', body: { orderId: order.orderId, ...order.request } });
    order.reset();
    queryClient.removeQueries({ queryKey: ['calculate'] });
    await navigateTo(`/orders/${created.id}`);
  } catch (error) {
    // No answer in time: the order may or may not have arrived. It is queued
    // with the same id, so sending it again later cannot create a second one.
    const why = classifyFailure(error);
    if (why === 'OFFLINE') {
      await queueOrder();
      return;
    }
    submitProblem.value = why === 'REFUSED' ? 'refused' : 'failed';
    if (why === 'REFUSED') {
      await calculation.refetch();
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <UButton to="/clients" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :aria-label="t('app.back')" />
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold">{{ client?.tradeName }}</h1>
        <p class="text-xs text-neutral-500">
          {{ t('clients.priceTable') }} {{ client?.priceTableId }} ·
          {{ t('clients.credit') }}: <strong data-testid="credit">{{ formatCents(calculation.data.value?.availableCreditCents ?? client?.creditAvailableCents ?? 0) }}</strong>
          <UBadge v-if="client?.priceTableFallback" color="warning" variant="subtle" size="sm">{{ t('clients.fallback') }}</UBadge>
        </p>
      </div>
    </div>

    <UAlert v-if="clientError" role="alert" color="error" variant="subtle" icon="i-lucide-user-x" :title="t('order.clientNotFound')" data-testid="client-not-found" />

    <template v-else>
      <UAlert v-if="notice" role="status" color="info" variant="subtle" icon="i-lucide-repeat" :title="t('repeat.notice')" :actions="[{ label: t('repeat.dismiss'), color: 'neutral', variant: 'outline', onClick: dismissRepeatNotice }]" data-testid="repeat-notice" />
      <UAlert v-if="skipped.length" role="status" color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="t('repeat.skippedTitle')" data-testid="repeat-skipped">
        <template #description>
          <ul class="list-disc pl-4">
            <li v-for="line in skipped" :key="line.productId">{{ line.description }}: {{ t(`repeat.reasons.${line.reason}`) }}</li>
          </ul>
        </template>
      </UAlert>

      <UAlert v-if="queueMode" role="status" color="warning" variant="subtle" icon="i-lucide-wifi-off" :title="t('order.offlineNotice')" data-testid="offline-order-notice" />

      <section class="space-y-2">
        <UInput v-model="text" size="xl" icon="i-lucide-search" :placeholder="t('order.searchPlaceholder')" class="w-full" autocomplete="off" data-testid="search" />
        <p v-if="text.trim().length < 2" class="text-xs text-neutral-500">{{ t('order.searchHint') }}</p>
        <template v-else>
          <UAlert v-if="search.data.value?.fromPhone" role="status" color="info" variant="subtle" icon="i-lucide-smartphone" :title="t('order.fromPhone')" data-testid="from-phone" />
          <p v-if="search.data.value && !search.data.value.items.length" class="text-sm text-neutral-500">{{ t('order.noResults') }}</p>
          <ProductResult
            v-for="product in search.data.value?.items"
            :key="product.id"
            :product="product"
            :added="order.lines.some((l) => l.productId === product.id)"
            @add="order.addProduct(product)"
          />
        </template>
      </section>

      <section class="space-y-2">
        <h2 class="font-medium">{{ t('order.lines') }}</h2>
        <p v-if="order.isEmpty" class="text-sm text-neutral-500" data-testid="empty-order">{{ t('order.emptyLines') }}</p>
        <OrderLineRow v-for="line in order.lines" :key="line.productId" :line="line" :calculated="calculatedByProduct.get(line.productId)" />
      </section>

      <UAlert v-if="calculation.isError.value && !queueMode" role="alert" color="warning" variant="subtle" icon="i-lucide-wifi-off" :title="t('order.calcFailed')" />
      <BlockerList v-if="showCalculation && calculation.data.value" :calculation="calculation.data.value" :descriptions="descriptions" />
      <UAlert v-if="submitProblem === 'refused'" role="alert" color="error" variant="subtle" icon="i-lucide-octagon-alert" :title="t('order.refused')" />
      <UAlert v-if="submitProblem === 'failed'" role="alert" color="error" variant="subtle" icon="i-lucide-wifi-off" :title="t('order.sendFailed')" />

      <footer class="fixed inset-x-0 bottom-11 z-20 border-t border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <UContainer class="space-y-2 p-0">
          <div class="flex items-end justify-between gap-3">
            <UFormField :label="t('order.orderDiscount')" :error="orderDiscountInvalid ? t('order.discountInvalid') : undefined" class="w-40">
              <UInput v-model="orderDiscountText" inputmode="decimal" placeholder="0" data-testid="order-discount" />
            </UFormField>
            <div class="text-right">
              <p v-if="calculation.data.value && !order.isEmpty" class="text-xs text-neutral-500">
                {{ t('order.subtotal') }} {{ formatCents(calculation.data.value.subtotalCents) }}
                <template v-if="calculation.data.value.orderDiscountCents"> − {{ formatCents(calculation.data.value.orderDiscountCents) }}</template>
              </p>
              <p class="text-xl font-semibold" data-testid="total">
                <span v-if="calculation.data.value && !order.isEmpty">
                  {{ formatCents(calculation.data.value.totalCents) }}
                  <UBadge v-if="queueMode" color="warning" variant="subtle" size="sm" data-testid="outdated">{{ t('order.outdated') }}</UBadge>
                </span>
                <span v-else class="text-neutral-400">—</span>
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 text-sm">
              <UBadge v-if="calculation.data.value?.canSubmit && !order.isEmpty && !queueMode" :color="calculation.data.value.status === 'SUBMITTED' ? 'success' : 'warning'" variant="subtle" data-testid="status">
                {{ t(`order.status.${calculation.data.value.status}`) }}
              </UBadge>
              <span v-if="calculation.isStale.value && !order.isEmpty" class="ml-2 text-xs text-neutral-500">{{ t('order.calculating') }}</span>
            </div>
            <UButton size="xl" :disabled="!canSend" class="disabled:opacity-40 aria-disabled:opacity-40" :loading="submitting" icon="i-lucide-send" :label="submitting ? t('order.sending') : queueMode ? t('order.queue') : t('order.send')" data-testid="send" @click="send" />
          </div>
        </UContainer>
      </footer>
    </template>
  </div>
</template>

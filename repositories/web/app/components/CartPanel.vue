<script setup lang="ts">
// The cart of the catalog page: the order being built, seen from the catalog.
// It is the same draft as the order page (useOrderStore), and every figure is the
// backend's (useCalculation); nothing is added up here.
const props = defineProps<{ clientName?: string }>();
const { t } = useI18n();
const order = useOrderStore();
const calculation = useCalculation();
const { online } = useConnectivity();

const calculatedByProduct = computed(() => new Map((calculation.data.value?.lines ?? []).map((line) => [line.productId, line])));
const descriptions = computed(() => Object.fromEntries(order.lines.map((l) => [l.productId, l.description])));

// Emptying loses the work, so it takes a second tap (as discarding a pending order).
const confirmingClear = ref(false);
function clear() {
  if (!confirmingClear.value) {
    confirmingClear.value = true;
    return;
  }
  order.reset();
  confirmingClear.value = false;
}
watch(() => order.lines.length, () => {
  confirmingClear.value = false;
});
</script>

<template>
  <section class="space-y-3" data-testid="cart-panel">
    <header class="flex items-baseline justify-between gap-2">
      <h2 class="min-w-0 truncate font-semibold">{{ props.clientName ? t('cart.for', { client: props.clientName }) : t('cart.title') }}</h2>
      <span class="shrink-0 text-sm text-neutral-500" data-testid="cart-count">{{ t('cart.itemCount', { n: order.lines.length }, order.lines.length) }}</span>
    </header>

    <p v-if="order.isEmpty" class="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700" data-testid="cart-empty">{{ t('cart.empty') }}</p>
    <OrderLineRow v-for="line in order.lines" :key="line.productId" :line="line" :calculated="calculatedByProduct.get(line.productId)" />

    <UAlert v-if="calculation.isError.value && online" role="alert" color="warning" variant="subtle" icon="i-lucide-wifi-off" :title="t('order.calcFailed')" />
    <BlockerList v-if="online && calculation.data.value && !order.isEmpty" :calculation="calculation.data.value" :descriptions="descriptions" />

    <div v-if="!order.isEmpty" class="space-y-1 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800/60">
      <p v-if="calculation.data.value" class="flex justify-between text-sm text-neutral-600 dark:text-neutral-300">
        <span>{{ t('cart.subtotal') }}</span>
        <span>{{ formatCents(calculation.data.value.subtotalCents) }}</span>
      </p>
      <p class="flex items-center justify-between text-lg font-semibold">
        <span>{{ t('cart.total') }}</span>
        <span data-testid="cart-total">
          <template v-if="calculation.data.value">{{ formatCents(calculation.data.value.totalCents) }}</template>
          <span v-else class="text-neutral-400">—</span>
        </span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge v-if="calculation.data.value?.canSubmit && online" :color="calculation.data.value.status === 'SUBMITTED' ? 'success' : 'warning'" variant="subtle" data-testid="cart-status">
          {{ t(`order.status.${calculation.data.value.status}`) }}
        </UBadge>
        <UBadge v-if="!online" color="warning" variant="subtle" data-testid="cart-outdated">{{ t('cart.outdated') }}</UBadge>
        <span v-if="calculation.isStale.value && online" class="text-xs text-neutral-500">{{ t('order.calculating') }}</span>
      </div>
    </div>

    <div v-if="!order.isEmpty && order.clientId" class="flex gap-2">
      <UButton :to="`/orders/new/${encodeURIComponent(order.clientId)}`" class="flex-1" justify="center" icon="i-lucide-clipboard-check" :label="t('cart.close')" data-testid="cart-close" />
      <UButton color="neutral" variant="outline" icon="i-lucide-trash-2" :label="confirmingClear ? t('cart.clearConfirm') : t('cart.clear')" data-testid="cart-clear" @click="clear" />
    </div>
  </section>
</template>

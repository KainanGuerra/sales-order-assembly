<script setup lang="ts">
import type { OrderStatus, OrderSummary } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('ordersList.title') });
const api = useApi();

const { data, error, status } = await useFetch<{ items: OrderSummary[] }>('/api/orders', { $fetch: api, query: { limit: 50 } });

// Only a view over what the server returned; no rule is applied here.
const ALL = 'ALL';
const STATUSES: OrderStatus[] = ['AWAITING_APPROVAL', 'APPROVED', 'SUBMITTED', 'INVOICED', 'REJECTED', 'CANCELLED'];
const filter = ref<string>(ALL);
const options = computed(() => [
  { label: t('ordersList.allStatuses'), value: ALL },
  ...STATUSES.map((s) => ({ label: t(`order.status.${s}`), value: s })),
]);
const shown = computed(() => (data.value?.items ?? []).filter((o) => filter.value === ALL || o.status === filter.value));
</script>

<template>
  <div class="space-y-3 pt-2">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('ordersList.title') }}</h1>
        <p class="text-sm text-neutral-500">{{ t('ordersList.subtitle') }}</p>
      </div>
      <UFormField :label="t('ordersList.status')">
        <USelect v-model="filter" :items="options" class="w-56" data-testid="status-filter" />
      </UFormField>
    </div>

    <UAlert v-if="error" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('ordersList.failed')" />
    <p v-else-if="status === 'success' && !shown.length" class="text-neutral-500" data-testid="no-orders">{{ t('ordersList.empty') }}</p>

    <UCard v-for="order in shown" :key="order.id" :data-testid="`order-${order.id}`">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :status="order.status" />
            <UBadge v-if="order.origin === 'IMPORTED'" color="neutral" variant="outline" size="sm">{{ t('history.imported') }}</UBadge>
          </div>
          <p class="truncate font-medium">{{ order.clientTradeName }}</p>
          <p class="text-lg font-semibold">{{ formatCents(order.totalCents) }}</p>
          <p class="text-sm text-neutral-500">{{ formatDateTime(order.createdAt) }} · {{ t('history.items', { n: order.itemCount }, order.itemCount) }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <UButton :to="`/orders/${order.id}`" color="neutral" variant="ghost" size="sm" icon="i-lucide-eye" :label="t('history.view')" />
          <RepeatButton :order-id="order.id" size="sm" />
        </div>
      </div>
    </UCard>
  </div>
</template>

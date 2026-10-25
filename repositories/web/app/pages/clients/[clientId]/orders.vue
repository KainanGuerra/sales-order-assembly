<script setup lang="ts">
import type { ClientView, OrderSummary } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('history.title') });
const api = useApi();
const route = useRoute();
const clientId = computed(() => encodeURIComponent(String(route.params.clientId)));

const { data: client } = await useFetch<ClientView>(() => `/api/clients/${clientId.value}`, { $fetch: api });
const { data, error, status } = await useFetch<{ items: OrderSummary[] }>(() => `/api/clients/${clientId.value}/orders`, { $fetch: api });
</script>

<template>
  <div class="space-y-3 pt-2">
    <div class="flex items-center gap-2">
      <UButton to="/clients" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :aria-label="t('app.back')" />
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold">{{ t('history.title') }}</h1>
        <p class="truncate text-sm text-neutral-500">{{ client?.tradeName }}</p>
      </div>
    </div>

    <UAlert v-if="error" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('history.failed')" />
    <p v-else-if="status === 'success' && !data?.items.length" class="text-neutral-500" data-testid="no-history">{{ t('history.empty') }}</p>

    <UCard v-for="order in data?.items" :key="order.id" :data-testid="`history-${order.id}`">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :status="order.status" />
            <UBadge v-if="order.origin === 'IMPORTED'" color="neutral" variant="outline" size="sm">{{ t('history.imported') }}</UBadge>
          </div>
          <p class="text-lg font-semibold">{{ formatCents(order.totalCents) }}</p>
          <p class="text-sm text-neutral-500">{{ formatDateTime(order.createdAt) }} · {{ t('history.items', { n: order.itemCount }, order.itemCount) }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <UButton :to="`/orders/${order.id}`" color="neutral" variant="ghost" size="sm" icon="i-lucide-eye" :label="t('history.view')" :data-testid="`view-${order.id}`" />
          <RepeatButton :order-id="order.id" size="sm" />
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ClientView } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('clients.title') });
const api = useApi();
const { data, error, status } = await useFetch<{ items: ClientView[] }>('/api/clients', { $fetch: api });
</script>

<template>
  <div class="space-y-3 pt-2">
    <h1 class="text-2xl font-semibold">{{ t('clients.title') }}</h1>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('errors.unavailable')" />
    <p v-else-if="status === 'success' && !data?.items.length" class="text-neutral-500">{{ t('clients.empty') }}</p>

    <template v-if="status === 'pending'">
      <USkeleton v-for="n in 3" :key="n" class="h-28 w-full" />
    </template>

    <UCard v-for="client in data?.items" :key="client.id" :data-testid="`client-${client.id}`">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate font-medium">{{ client.tradeName }}</h2>
          <p class="text-sm text-neutral-500">{{ client.city }}/{{ client.state }}</p>
          <p class="mt-2 text-sm">
            {{ t('clients.credit') }}:
            <strong :class="client.creditAvailableCents === 0 ? 'text-red-600' : ''">{{ formatCents(client.creditAvailableCents) }}</strong>
          </p>
          <p class="text-sm text-neutral-500">
            {{ t('clients.priceTable') }}: {{ client.priceTableId }}
            <UBadge v-if="client.priceTableFallback" color="warning" variant="subtle" size="sm" class="ml-1">{{ t('clients.fallback') }}</UBadge>
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <UButton :to="`/orders/new/${client.id}`" icon="i-lucide-shopping-cart" :label="t('clients.newOrder')" :data-testid="`order-${client.id}`" />
          <UButton :to="`/clients/${client.id}/orders`" color="neutral" variant="outline" size="sm" icon="i-lucide-history" :label="t('history.open')" :data-testid="`history-${client.id}`" />
        </div>
      </div>
    </UCard>
  </div>
</template>

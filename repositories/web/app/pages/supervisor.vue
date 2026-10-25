<script setup lang="ts">
import type { PendingOrder } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('supervisor.title') });
const api = useApi();
const { data, error, status, refresh } = await useFetch<{ items: PendingOrder[] }>('/api/approvals', { $fetch: api });
</script>

<template>
  <div class="space-y-3 pt-2">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('supervisor.title') }}</h1>
        <p class="text-sm text-neutral-500">{{ t('supervisor.subtitle') }}</p>
      </div>
      <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" :loading="status === 'pending'" :label="t('supervisor.refresh')" @click="refresh()" />
    </div>

    <UAlert v-if="error" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('errors.unavailable')" />
    <p v-else-if="status === 'success' && !data?.items.length" class="text-neutral-500" data-testid="no-pending">{{ t('supervisor.empty') }}</p>

    <UCard v-for="order in data?.items" :key="order.id" :data-testid="`pending-${order.id}`">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <p class="truncate font-medium">{{ order.clientTradeName }}</p>
          <p class="text-sm text-neutral-500">{{ t('supervisor.from') }}: {{ order.sellerName }} · {{ formatDateTime(order.createdAt) }}</p>
          <p class="text-lg font-semibold">{{ formatCents(order.totalCents) }}</p>
          <UBadge v-for="(reason, index) in order.approvalReasons" :key="index" color="warning" variant="subtle" size="sm" class="mr-1">
            {{ reason.code === 'LINE_DISCOUNT_ABOVE_LIMIT' ? t('approvals.reasonLine', { discount: formatBasisPoints(reason.discountBp) }) : t('approvals.reasonOrder', { discount: formatBasisPoints(reason.discountBp) }) }}
          </UBadge>
        </div>
        <UButton :to="`/approvals/${order.id}`" icon="i-lucide-search-check" :label="t('supervisor.open')" :data-testid="`open-${order.id}`" />
      </div>
    </UCard>
  </div>
</template>

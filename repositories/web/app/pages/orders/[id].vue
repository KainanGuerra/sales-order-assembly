<script setup lang="ts">
import type { ApprovalReason, OrderView } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('done.title') });
const api = useApi();
const route = useRoute();
const { data: order, error } = await useFetch<OrderView>(() => `/api/orders/${encodeURIComponent(String(route.params.id))}`, { $fetch: api });

function approvalText(reason: ApprovalReason): string {
  const names = new Map(order.value?.items.map((i) => [i.productId, i.description]));
  return reason.code === 'LINE_DISCOUNT_ABOVE_LIMIT'
    ? t('approvalSaved.LINE_DISCOUNT_ABOVE_LIMIT', { discount: formatBasisPoints(reason.discountBp), product: names.get(reason.productId) ?? reason.productId })
    : t('approvalSaved.ORDER_DISCOUNT_ABOVE_LIMIT', { discount: formatBasisPoints(reason.discountBp) });
}
</script>

<template>
  <div class="space-y-4 pt-2">
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('errors.generic')" />

    <template v-if="order">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ t('done.title') }}</h1>
        <UBadge size="lg" :color="order.status === 'SUBMITTED' ? 'success' : 'warning'" variant="subtle" data-testid="order-status">{{ t(`order.status.${order.status}`) }}</UBadge>
      </div>
      <p class="text-sm text-neutral-500">{{ t('done.number') }} {{ order.id }}</p>

      <UAlert
        v-for="reason in order.approvalReasons"
        :key="reason.code + ('productId' in reason ? reason.productId : '')"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-check"
        :title="approvalText(reason)"
      />

      <UCard>
        <template #header>{{ t('done.items') }}</template>
        <ul class="divide-y divide-neutral-200 dark:divide-neutral-800">
          <li v-for="item in order.items" :key="item.productId" class="flex justify-between gap-3 py-2 text-sm">
            <span class="min-w-0">
              {{ item.description }}
              <span class="block text-xs text-neutral-500">{{ item.quantityUnits }} un. × {{ formatCents(item.unitPriceCents) }}<template v-if="item.discountBp"> − {{ formatBasisPoints(item.discountBp) }}</template></span>
            </span>
            <strong>{{ formatCents(item.netCents) }}</strong>
          </li>
        </ul>
        <template #footer>
          <div class="flex justify-between text-sm">
            <span>{{ t('order.subtotal') }}</span><span>{{ formatCents(order.subtotalCents) }}</span>
          </div>
          <div v-if="order.orderDiscountCents" class="flex justify-between text-sm">
            <span>{{ t('order.orderDiscount') }} ({{ formatBasisPoints(order.orderDiscountBp) }})</span><span>− {{ formatCents(order.orderDiscountCents) }}</span>
          </div>
          <div class="mt-1 flex justify-between text-lg font-semibold">
            <span>{{ t('order.total') }}</span><span data-testid="order-total">{{ formatCents(order.totalCents) }}</span>
          </div>
        </template>
      </UCard>

      <div class="flex gap-2">
        <UButton to="/clients" color="neutral" variant="outline" :label="t('done.toClients')" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { OrderView } from '~/types/api';

defineProps<{ order: OrderView }>();
const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>{{ t('done.items') }}</template>
    <ul class="divide-y divide-neutral-200 dark:divide-neutral-800">
      <li v-for="item in order.items" :key="item.productId" class="flex justify-between gap-3 py-2 text-sm">
        <span class="min-w-0">
          {{ item.description }}
          <span class="block text-xs text-neutral-500">
            {{ item.quantityUnits }} un. × {{ formatCents(item.unitPriceCents) }}<template v-if="item.discountBp"> − {{ formatBasisPoints(item.discountBp) }}</template>
          </span>
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
</template>

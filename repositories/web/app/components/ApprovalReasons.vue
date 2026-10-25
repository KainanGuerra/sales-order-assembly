<script setup lang="ts">
import type { ApprovalReason, OrderItemView } from '~/types/api';

// Why an order needed approval, in words. The reasons were decided by the
// backend when the order was sent; this only chooses the sentences.
const props = defineProps<{ reasons: ApprovalReason[]; items: Pick<OrderItemView, 'productId' | 'description'>[] }>();
const { t } = useI18n();

const names = computed(() => new Map(props.items.map((item) => [item.productId, item.description])));

function text(reason: ApprovalReason): string {
  if (reason.code === 'LINE_DISCOUNT_ABOVE_LIMIT') {
    return t('approvalSaved.LINE_DISCOUNT_ABOVE_LIMIT', {
      discount: formatBasisPoints(reason.discountBp),
      product: names.value.get(reason.productId) ?? reason.productId,
    });
  }
  return t('approvalSaved.ORDER_DISCOUNT_ABOVE_LIMIT', { discount: formatBasisPoints(reason.discountBp) });
}
</script>

<template>
  <div class="space-y-2">
    <UAlert
      v-for="reason in reasons"
      :key="reason.code + ('productId' in reason ? reason.productId : '')"
      role="status"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-check"
      :title="text(reason)"
      data-testid="approval-reason"
    />
  </div>
</template>

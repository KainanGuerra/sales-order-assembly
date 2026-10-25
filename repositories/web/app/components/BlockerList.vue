<script setup lang="ts">
import type { ApprovalReason, Calculation } from '~/types/api';

// Turns the codes the backend sends into sentences. The rules stay in the
// backend; this only chooses the words.
const props = defineProps<{ calculation: Calculation; descriptions: Record<string, string> }>();
const { t } = useI18n();

const blockers = computed(() => props.calculation.blockers.map((code) => t(`blockers.${code}`, { minimum: formatCents(props.calculation.minimumOrderCents) })));

function approvalText(reason: ApprovalReason): string {
  const limit = formatBasisPoints(props.calculation.effectiveDiscountLimitBp);
  if (reason.code === 'LINE_DISCOUNT_ABOVE_LIMIT') {
    return t('approval.LINE_DISCOUNT_ABOVE_LIMIT', {
      discount: formatBasisPoints(reason.discountBp),
      product: props.descriptions[reason.productId] ?? reason.productId,
      limit,
    });
  }
  return t('approval.ORDER_DISCOUNT_ABOVE_LIMIT', { discount: formatBasisPoints(reason.discountBp), limit });
}
</script>

<template>
  <div class="space-y-2">
    <UAlert v-for="text in blockers" :key="text" role="alert" color="error" variant="subtle" icon="i-lucide-octagon-alert" :title="text" data-testid="blocker" />
    <UAlert
      v-for="reason in calculation.approvalReasons"
      :key="reason.code + ('productId' in reason ? reason.productId : '')"
      role="status"
      color="warning"
      variant="subtle"
      icon="i-lucide-user-check"
      :title="approvalText(reason)"
      data-testid="approval-reason"
    />
  </div>
</template>

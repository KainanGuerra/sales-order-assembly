<script setup lang="ts">
import type { OrderStatus } from '~/types/api';

defineProps<{ status: OrderStatus; size?: 'sm' | 'md' | 'lg' }>();
const { t } = useI18n();

const colors = {
  AWAITING_APPROVAL: 'warning',
  APPROVED: 'info',
  SUBMITTED: 'success',
  INVOICED: 'primary',
  REJECTED: 'error',
  CANCELLED: 'error',
} as const;
</script>

<template>
  <UBadge :color="colors[status]" variant="subtle" :size="size ?? 'md'" :data-status="status">{{ t(`order.status.${status}`) }}</UBadge>
</template>

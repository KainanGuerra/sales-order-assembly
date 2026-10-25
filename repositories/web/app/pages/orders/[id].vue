<script setup lang="ts">
import type { OrderView } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('done.title') });
const api = useApi();
const route = useRoute();
const { data: order, error } = await useFetch<OrderView>(() => `/api/orders/${encodeURIComponent(String(route.params.id))}`, { $fetch: api });
</script>

<template>
  <div class="space-y-4 pt-2">
    <UAlert v-if="error" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('errors.generic')" />

    <template v-if="order">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ t('done.title') }}</h1>
        <StatusBadge :status="order.status" size="lg" data-testid="order-status" />
      </div>
      <p class="text-sm text-neutral-500">{{ order.clientTradeName }} · {{ t('done.number') }} {{ order.id }}</p>

      <UAlert
        v-if="order.rejection"
        role="alert"
        color="error"
        variant="subtle"
        icon="i-lucide-octagon-x"
        :title="`${t('done.rejectedBecause')}: ${t(`rejectionReasons.${order.rejection.code}`)}`"
        :description="order.rejection.text ?? undefined"
        data-testid="rejection"
      />
      <ApprovalReasons v-else-if="order.status === 'AWAITING_APPROVAL'" :reasons="order.approvalReasons" :items="order.items" />

      <OrderDetails :order="order" />

      <section class="space-y-2">
        <h2 class="font-medium">{{ t('done.history') }}</h2>
        <OrderHistory :history="order.history" />
      </section>

      <div class="flex gap-2">
        <UButton to="/clients" color="neutral" variant="outline" :label="t('done.toClients')" />
      </div>
    </template>
  </div>
</template>

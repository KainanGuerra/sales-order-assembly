<script setup lang="ts">
// The cart in the header: how many items the seller has put in the order being
// built, and a way back to it. Hidden while the order is empty.
const { t } = useI18n();
const order = useOrderStore();
const { user } = useSession();
const show = computed(() => user.value?.role === 'SELLER' && !!order.clientId && order.lines.length > 0);
</script>

<template>
  <UChip v-if="show" :text="order.lines.length" size="3xl" color="primary">
    <UButton :to="`/orders/new/${encodeURIComponent(order.clientId ?? '')}`" color="neutral" variant="ghost" icon="i-lucide-shopping-cart" :aria-label="t('cart.openCart')" data-testid="cart-badge" />
  </UChip>
</template>

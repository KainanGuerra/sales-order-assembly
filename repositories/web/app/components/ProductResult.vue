<script setup lang="ts">
import type { DraftLine } from '~/stores/order';
import type { ProductSearchItem } from '~/types/api';

// `added` is the plain "already on the order" mark. With `line`, the card also
// shows the cart controls (quantity, unit, remove) for that line. `locked` keeps
// the add button off, with `lockedHint` saying why (the catalog without a client).
const props = defineProps<{ product: ProductSearchItem; added: boolean; line?: DraftLine; locked?: boolean }>();
defineEmits<{ add: []; remove: []; setQuantity: [quantity: number]; setUnit: [unit: 'UNIT' | 'PACK'] }>();
const { t } = useI18n();

const available = computed(() => props.product.availability === 'AVAILABLE');
const unitItems = computed(() => [
  { label: t('order.unitOptions.UNIT'), value: 'UNIT' },
  { label: t('order.unitOptions.PACK', { n: props.product.packFactor }), value: 'PACK' },
]);
</script>

<template>
  <div class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900" :class="{ 'opacity-60': !available }" data-testid="product-result">
    <div class="min-w-0">
      <p class="truncate font-medium">{{ product.description }}</p>
      <p class="text-xs text-neutral-500">{{ product.sku }} · {{ product.ean }}</p>
      <p v-if="available && product.unitPriceCents !== null" class="text-sm">
        {{ formatCents(product.unitPriceCents) }} / un.
        <span v-if="product.multipleOnly" class="text-neutral-500"> · {{ t('order.packOnly', { n: product.packFactor }) }}</span>
        <span v-else-if="product.packFactor > 1" class="text-neutral-500"> · {{ product.packFactor }} un./emb.</span>
      </p>
      <UBadge v-else-if="product.reason" color="warning" variant="subtle" size="sm">{{ t(`availability.${product.reason}`) }}</UBadge>
    </div>
    <div v-if="line" class="flex shrink-0 flex-col items-end gap-2" data-testid="cart-controls">
      <div class="flex items-center gap-1">
        <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-minus" :disabled="line.quantity <= 1" :aria-label="t('cart.decrease')" data-testid="qty-minus" @click="$emit('setQuantity', line.quantity - 1)" />
        <span class="w-9 text-center font-medium tabular-nums" data-testid="qty-value">{{ line.quantity }}</span>
        <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-plus" :aria-label="t('cart.increase')" data-testid="qty-plus" @click="$emit('setQuantity', line.quantity + 1)" />
      </div>
      <USelect v-if="product.packFactor > 1" :model-value="line.unit" :items="unitItems" size="xs" class="w-40" data-testid="card-unit" @update:model-value="$emit('setUnit', $event as 'UNIT' | 'PACK')" />
      <UButton color="error" variant="soft" size="xs" icon="i-lucide-trash-2" :label="t('order.remove')" data-testid="remove-product" @click="$emit('remove')" />
    </div>
    <UButton v-else-if="added" color="neutral" variant="soft" size="sm" icon="i-lucide-check" :label="t('order.added')" disabled />
    <UButton v-else :disabled="!available || locked" size="sm" icon="i-lucide-plus" :label="t('order.add')" data-testid="add-product" @click="$emit('add')" />
  </div>
</template>

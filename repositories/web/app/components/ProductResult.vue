<script setup lang="ts">
import type { ProductSearchItem } from '~/types/api';

const props = defineProps<{ product: ProductSearchItem; added: boolean }>();
defineEmits<{ add: [] }>();
const { t } = useI18n();

const available = computed(() => props.product.availability === 'AVAILABLE');
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
    <UButton v-if="added" color="neutral" variant="soft" size="sm" icon="i-lucide-check" :label="t('order.added')" disabled />
    <UButton v-else :disabled="!available" size="sm" icon="i-lucide-plus" :label="t('order.add')" data-testid="add-product" @click="$emit('add')" />
  </div>
</template>

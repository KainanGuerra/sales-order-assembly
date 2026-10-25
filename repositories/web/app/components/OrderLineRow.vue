<script setup lang="ts">
import type { CalculatedLine } from '~/types/api';
import type { DraftLine } from '~/stores/order';

const props = defineProps<{ line: DraftLine; calculated?: CalculatedLine }>();
const { t } = useI18n();
const order = useOrderStore();

const unitItems = computed(() => [
  { label: t('order.unitOptions.UNIT'), value: 'UNIT' },
  { label: t('order.unitOptions.PACK', { n: props.line.packFactor }), value: 'PACK' },
]);

// A plain number box: it updates as the seller types (the stepper component
// only committed when the box lost focus, so the total lagged behind).
const quantity = computed({
  get: () => props.line.quantity,
  set: (value: number | string | null | undefined) => order.setQuantity(props.line.productId, typeof value === 'number' ? value : 0),
});

const unit = computed({
  get: () => props.line.unit,
  set: (value: 'UNIT' | 'PACK') => order.setUnit(props.line.productId, value),
});

// The box holds text so "2,5" can be typed; the store holds basis points.
const discountText = ref(basisPointsToInput(props.line.discountBp));
const discountInvalid = ref(false);
watch(discountText, (text) => {
  const bp = parsePercentToBasisPoints(text);
  discountInvalid.value = bp === null;
  if (bp !== null) {
    order.setLineDiscount(props.line.productId, bp);
  }
});

const blockerTexts = computed(() => (props.calculated?.blockers ?? []).map((code) => t(`blockers.${code}`, { n: props.line.packFactor })));
</script>

<template>
  <UCard :ui="{ body: 'p-3 sm:p-4' }" data-testid="order-line">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="truncate font-medium">{{ line.description }}</p>
        <p v-if="calculated?.unitPriceCents != null && calculated.quantityUnits != null" class="text-xs text-neutral-500">
          {{ t('order.unitsInfo', { n: calculated.quantityUnits, price: formatCents(calculated.unitPriceCents) }) }}
        </p>
      </div>
      <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" :aria-label="t('order.remove')" data-testid="remove-line" @click="order.removeLine(line.productId)" />
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <UFormField :label="t('order.quantity')">
        <UInput v-model.number="quantity" type="number" inputmode="numeric" min="1" step="1" class="w-full" data-testid="quantity" />
      </UFormField>
      <UFormField :label="t('order.unit')">
        <USelect v-if="line.packFactor > 1" v-model="unit" :items="unitItems" class="w-full" data-testid="unit" />
        <p v-else class="pt-2 text-sm text-neutral-500">{{ t('order.unitOptions.UNIT') }}</p>
      </UFormField>
      <UFormField :label="t('order.discount')" :error="discountInvalid ? t('order.discountInvalid') : undefined">
        <UInput v-model="discountText" inputmode="decimal" placeholder="0" class="w-full" data-testid="line-discount" />
      </UFormField>
      <div class="flex flex-col justify-end text-right">
        <span class="text-xs text-neutral-500">{{ t('order.total') }}</span>
        <strong v-if="calculated?.netCents != null" data-testid="line-total">{{ formatCents(calculated.netCents) }}</strong>
        <strong v-else class="text-neutral-400">—</strong>
      </div>
    </div>

    <ul v-if="blockerTexts.length" class="mt-2 space-y-1 text-sm text-red-600" data-testid="line-blockers">
      <li v-for="text in blockerTexts" :key="text">{{ text }}</li>
    </ul>
  </UCard>
</template>

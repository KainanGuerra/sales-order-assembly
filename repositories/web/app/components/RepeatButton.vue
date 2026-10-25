<script setup lang="ts">
import type { RepeatDraft, SkippedLine } from '~/types/api';

// Repeats an old order: asks the backend for a draft (the same products and
// quantities from today's catalog, discounts at zero) and loads it as the order
// being built. If an order is already in progress, it asks before replacing it.
const props = defineProps<{ orderId: string; size?: 'sm' | 'md' | 'lg' }>();
const { t } = useI18n();
const api = useApi();
const order = useOrderStore();
const skipped = useState<SkippedLine[]>('repeat-skipped', () => []);
const notice = useState<boolean>('repeat-notice', () => false);

const working = ref(false);
const failed = ref(false);
// The old order has nothing that can be ordered again (all discontinued, say).
const nothingLeft = ref(false);
const confirmOpen = ref(false);
const pending = ref<RepeatDraft | null>(null);

async function repeat() {
  working.value = true;
  failed.value = false;
  nothingLeft.value = false;
  try {
    const draft = await api<RepeatDraft>(`/api/orders/${encodeURIComponent(props.orderId)}/repeat`);
    if (draft.items.length === 0) {
      // Nothing to copy: say so, and leave the order in progress alone.
      nothingLeft.value = true;
      return;
    }
    if (!order.isEmpty) {
      pending.value = draft;
      confirmOpen.value = true;
      return;
    }
    await apply(draft);
  } catch {
    failed.value = true;
  } finally {
    working.value = false;
  }
}

async function apply(draft: RepeatDraft) {
  order.replaceWith(draft.clientId, draft.items);
  skipped.value = draft.skipped;
  notice.value = true;
  confirmOpen.value = false;
  pending.value = null;
  await navigateTo(`/orders/new/${encodeURIComponent(draft.clientId)}`);
}
</script>

<template>
  <div>
    <UButton :size="size ?? 'md'" color="neutral" variant="outline" icon="i-lucide-repeat" :loading="working" :label="working ? t('repeat.working') : t('repeat.button')" data-testid="repeat" @click="repeat" />
    <p v-if="failed || nothingLeft" role="alert" class="mt-1 text-xs text-red-600" data-testid="repeat-failed">
      {{ nothingLeft ? t('repeat.noneLeft') : t('repeat.failed') }}
    </p>

    <UModal v-model:open="confirmOpen" :title="t('repeat.confirmTitle')" :description="t('repeat.confirmBody')">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" :label="t('repeat.cancel')" @click="confirmOpen = false" />
          <UButton :label="t('repeat.confirm')" data-testid="repeat-confirm" @click="pending && apply(pending)" />
        </div>
      </template>
    </UModal>
  </div>
</template>

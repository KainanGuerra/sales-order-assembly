<script setup lang="ts">
import { REJECTION_REASON_CODES, type OrderView, type RejectionReasonCode } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('approvals.title') });
const api = useApi();
const route = useRoute();
const toast = useToast();
const url = computed(() => `/api/orders/${encodeURIComponent(String(route.params.id))}`);
const { data: order, error, refresh } = await useFetch<OrderView>(url, { $fetch: api });

const decidable = computed(() => order.value?.status === 'AWAITING_APPROVAL');

// ---- approve
const busy = ref<'approve' | 'reject' | null>(null);
const problem = ref<'decided' | 'failed' | null>(null);

function statusOf(e: unknown): number | undefined {
  return (e as { statusCode?: number; status?: number }).statusCode ?? (e as { status?: number }).status;
}

async function decide(kind: 'approve' | 'reject', body?: object) {
  busy.value = kind;
  problem.value = null;
  try {
    await api(`${url.value}/${kind}`, { method: 'POST', body });
    toast.add({ title: t(kind === 'approve' ? 'approvals.approved' : 'approvals.rejected'), color: kind === 'approve' ? 'success' : 'neutral' });
    rejecting.value = false;
    await refresh();
  } catch (e) {
    // Someone decided first (409): show how it ended instead of an error.
    problem.value = statusOf(e) === 409 ? 'decided' : 'failed';
    if (statusOf(e) === 409) {
      await refresh();
    }
  } finally {
    busy.value = null;
  }
}

// ---- reject: one of the listed reasons; "other" needs a text
const rejecting = ref(false);
const reasonCode = ref<RejectionReasonCode | undefined>();
const reasonText = ref('');

const reasonItems = computed(() => REJECTION_REASON_CODES.map((code) => ({ label: t(`rejectionReasons.${code}`), value: code })));
const needsText = computed(() => reasonCode.value === 'OTHER');
const textValid = computed(() => !needsText.value || reasonText.value.trim().length >= 3);
const canConfirmReject = computed(() => !!reasonCode.value && textValid.value);

function reject() {
  if (!canConfirmReject.value) {
    return;
  }
  void decide('reject', { reasonCode: reasonCode.value, ...(reasonText.value.trim() ? { reasonText: reasonText.value.trim() } : {}) });
}
</script>

<template>
  <div class="space-y-4 pt-2">
    <div class="flex items-center gap-2">
      <UButton to="/supervisor" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :aria-label="t('approvals.back')" />
      <h1 class="text-xl font-semibold">{{ t('approvals.title') }}</h1>
    </div>

    <UAlert v-if="error" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('approvals.notFound')" data-testid="not-found" />

    <template v-if="order">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-lg font-medium">{{ order.clientTradeName }}</p>
          <p class="text-sm text-neutral-500">{{ t('approvals.seller') }}: {{ order.sellerName }} · {{ formatDateTime(order.createdAt) }}</p>
        </div>
        <StatusBadge :status="order.status" size="lg" data-testid="order-status" />
      </div>

      <UAlert v-if="problem === 'decided'" role="alert" color="warning" variant="subtle" icon="i-lucide-info" :title="t('approvals.alreadyDecided')" />
      <UAlert v-if="problem === 'failed'" role="alert" color="error" variant="subtle" icon="i-lucide-wifi-off" :title="t('approvals.failed')" />

      <UAlert
        v-if="order.rejection"
        role="alert"
        color="error"
        variant="subtle"
        icon="i-lucide-octagon-x"
        :title="`${t('done.rejectedBecause')}: ${t(`rejectionReasons.${order.rejection.code}`)}`"
        :description="order.rejection.text ?? undefined"
      />
      <ApprovalReasons :reasons="order.approvalReasons" :items="order.items" />

      <OrderDetails :order="order" />

      <div v-if="decidable && !rejecting" class="flex gap-2">
        <UButton size="xl" class="flex-1" icon="i-lucide-check" :loading="busy === 'approve'" :disabled="busy !== null" :label="busy === 'approve' ? t('approvals.approving') : t('approvals.approve')" data-testid="approve" @click="decide('approve')" />
        <UButton size="xl" class="flex-1" color="error" variant="outline" icon="i-lucide-x" :disabled="busy !== null" :label="t('approvals.reject')" data-testid="reject" @click="rejecting = true" />
      </div>

      <UCard v-if="decidable && rejecting" data-testid="reject-form">
        <template #header>{{ t('approvals.rejectTitle') }}</template>
        <div class="space-y-3">
          <UFormField :label="t('approvals.reasonLabel')">
            <USelect v-model="reasonCode" :items="reasonItems" :placeholder="t('approvals.reasonPlaceholder')" class="w-full" data-testid="reason" />
          </UFormField>
          <UFormField v-if="needsText" :label="t('approvals.reasonTextLabel')" :help="t('approvals.reasonTextHelp')" :error="reasonText.length > 0 && !textValid ? t('approvals.reasonTextHelp') : undefined">
            <UTextarea v-model="reasonText" :rows="3" class="w-full" data-testid="reason-text" />
          </UFormField>
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" :disabled="busy !== null" :label="t('approvals.cancel')" @click="rejecting = false" />
            <UButton class="flex-1" color="error" :disabled="!canConfirmReject || busy !== null" :loading="busy === 'reject'" :label="busy === 'reject' ? t('approvals.rejecting') : t('approvals.confirmReject')" data-testid="confirm-reject" @click="reject" />
          </div>
        </div>
      </UCard>

      <section class="space-y-2">
        <h2 class="font-medium">{{ t('approvals.history') }}</h2>
        <OrderHistory :history="order.history" />
      </section>
    </template>
  </div>
</template>

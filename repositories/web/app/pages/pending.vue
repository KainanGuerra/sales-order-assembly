<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t('pendingPage.title') });
const { user } = useSession();
const pending = usePendingStore();
const count = computed(() => (user.value ? pending.of(user.value.id).length : 0));
</script>

<template>
  <div class="space-y-3 pt-2">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('pendingPage.title') }}</h1>
      <p class="text-sm text-neutral-500">{{ t('pendingPage.subtitle') }}</p>
    </div>
    <p v-if="!count" class="text-neutral-500" data-testid="no-pending-orders">{{ t('pendingPage.empty') }}</p>
    <PendingOrders />
  </div>
</template>

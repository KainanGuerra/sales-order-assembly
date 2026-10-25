<script setup lang="ts">
// Shown on every screen while the server cannot be reached. It says what still
// works, so the seller does not wonder whether the work is being lost.
const { t } = useI18n();
const { online } = useConnectivity();
const { user } = useSession();
const pending = usePendingStore();
const waiting = computed(() => (user.value ? pending.waitingOf(user.value.id).length : 0));
</script>

<template>
  <UAlert
    v-if="!online"
    role="status"
    color="warning"
    variant="subtle"
    icon="i-lucide-wifi-off"
    :title="t('offline.title')"
    :description="waiting ? t('offline.withWaiting', { n: waiting }) : t('offline.body')"
    data-testid="offline-banner"
  />
</template>

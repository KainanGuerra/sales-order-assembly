<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t('supervisor.title') });
</script>

<template>
  <div class="space-y-3 pt-4">
    <h1 class="text-2xl font-semibold">{{ t('supervisor.title') }}</h1>
    <UAlert color="neutral" variant="subtle" icon="i-lucide-clock" :title="t('supervisor.body')" />
  </div>
</template>

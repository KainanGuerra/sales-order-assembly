<script setup lang="ts">
import type { HistoryStep } from '~/types/api';

defineProps<{ history: HistoryStep[] }>();
const { t } = useI18n();

function who(actor: string): string {
  const parsed = parseActor(actor);
  return parsed.kind === 'system' ? t('done.system') : parsed.name;
}
</script>

<template>
  <ol class="space-y-3 border-l border-neutral-300 pl-4 dark:border-neutral-700" data-testid="history">
    <li v-for="(step, index) in history" :key="index" class="relative text-sm" :data-step="step.status">
      <span class="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-neutral-400" />
      <div class="flex flex-wrap items-center gap-2">
        <StatusBadge :status="step.status" size="sm" />
        <span class="text-neutral-500">{{ t('done.by') }} {{ who(step.actor) }} · {{ formatDateTime(step.at) }}</span>
      </div>
      <p v-if="step.reasonCode" class="mt-1 text-neutral-600 dark:text-neutral-300">
        {{ t(`rejectionReasons.${step.reasonCode}`) }}<template v-if="step.reasonText">: {{ step.reasonText }}</template>
      </p>
    </li>
  </ol>
</template>

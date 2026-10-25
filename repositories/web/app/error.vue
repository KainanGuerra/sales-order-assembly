<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const { t } = useI18n();

const notFound = computed(() => props.error.statusCode === 404);
const toStart = () => clearError({ redirect: '/' });
</script>

<template>
  <UApp>
    <div class="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 p-6">
      <p class="text-sm text-neutral-500">{{ error.statusCode }}</p>
      <h1 class="text-2xl font-semibold">{{ notFound ? t('errors.notFound') : t('errors.generic') }}</h1>
      <p class="text-neutral-600 dark:text-neutral-300">{{ notFound ? t('errors.notFoundBody') : t('errors.unavailable') }}</p>
      <UButton icon="i-lucide-house" :label="t('errors.toStart')" @click="toStart" />
    </div>
  </UApp>
</template>

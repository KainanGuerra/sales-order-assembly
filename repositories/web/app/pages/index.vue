<script setup lang="ts">
import type { LoginOptions, Role } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('login.title') });
const { login } = useSession();
const { data: options, error: optionsError } = await useFetch<LoginOptions>('/api/auth/options');

const failed = ref(false);
const busy = ref<string | null>(null);

async function pick(role: Role, id: string) {
  busy.value = id;
  failed.value = false;
  try {
    await login(role, id);
  } catch {
    failed.value = true;
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6 pt-6">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('login.title') }}</h1>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{{ t('login.subtitle') }}</p>
    </div>

    <UAlert v-if="failed || optionsError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('login.failed')" />

    <section v-if="options" class="space-y-2">
      <h2 class="text-sm font-medium text-neutral-500">{{ t('login.sellers') }}</h2>
      <UButton
        v-for="seller in options.sellers"
        :key="seller.id"
        block
        size="xl"
        color="neutral"
        variant="outline"
        icon="i-lucide-user"
        :label="seller.name"
        :loading="busy === seller.id"
        :data-testid="`pick-${seller.id}`"
        @click="pick('SELLER', seller.id)"
      />
    </section>

    <section v-if="options?.supervisors.length" class="space-y-2">
      <h2 class="text-sm font-medium text-neutral-500">{{ t('login.supervisors') }}</h2>
      <UButton
        v-for="supervisor in options.supervisors"
        :key="supervisor.id"
        block
        size="xl"
        color="neutral"
        variant="outline"
        icon="i-lucide-shield-check"
        :label="supervisor.name"
        :loading="busy === supervisor.id"
        :data-testid="`pick-${supervisor.id}`"
        @click="pick('SUPERVISOR', supervisor.id)"
      />
    </section>
  </div>
</template>

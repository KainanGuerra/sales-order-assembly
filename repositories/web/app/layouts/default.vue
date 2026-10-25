<script setup lang="ts">
const { t } = useI18n();
const { user, logout } = useSession();
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950">
    <header class="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
      <UContainer class="flex h-14 items-center justify-between gap-3">
        <NuxtLink to="/" class="font-semibold">{{ t('app.title') }}</NuxtLink>
        <div v-if="user" class="flex items-center gap-3 text-sm">
          <NotificationBell />
          <span class="truncate text-neutral-600 dark:text-neutral-300">{{ user.name }}</span>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-log-out" :label="t('app.logout')" @click="logout" />
        </div>
      </UContainer>
    </header>
    <UContainer class="py-4 pb-40">
      <slot />
    </UContainer>
  </div>
</template>

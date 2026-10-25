<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t('notifications.title') });
const { list, unread, open, readAll, message } = useNotifications();
</script>

<template>
  <div class="space-y-3 pt-2">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">{{ t('notifications.title') }}</h1>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-check-check"
        :label="t('notifications.readAll')"
        :disabled="!unread.data.value"
        data-testid="read-all"
        @click="readAll()"
      />
    </div>

    <UAlert v-if="list.isError.value" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('errors.unavailable')" />
    <p v-else-if="list.isSuccess.value && !list.data.value?.length" class="text-neutral-500" data-testid="no-notifications">{{ t('notifications.empty') }}</p>

    <UCard v-for="notification in list.data.value" :key="notification.id" :data-testid="`notification-${notification.kind}`" :class="{ 'opacity-60': notification.resolved }">
      <button type="button" class="flex w-full items-start gap-3 text-left" @click="open(notification)">
        <span class="mt-2 size-2 shrink-0 rounded-full" :class="notification.read ? 'bg-transparent' : 'bg-primary'" :aria-label="notification.read ? undefined : t('notifications.unread')" />
        <span class="min-w-0 flex-1 space-y-1">
          <span class="block" :class="{ 'font-medium': !notification.read }">{{ message(notification) }}</span>
          <span class="block text-sm text-neutral-500">
            {{ formatDateTime(notification.createdAt) }}
            <template v-if="notification.resolved"> · {{ t('notifications.resolved') }}</template>
          </span>
        </span>
      </button>
    </UCard>
  </div>
</template>

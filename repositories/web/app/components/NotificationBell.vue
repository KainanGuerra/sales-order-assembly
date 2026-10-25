<script setup lang="ts">
import type { NotificationView } from '~/types/api';

const { t } = useI18n();
const toast = useToast();
const api = useApi();
const { $queryClient } = useNuxtApp();
const { unread, message } = useNotifications();

// The server pushes "something changed"; the list is then read again, so a
// message missed while the connection was down costs nothing. Anything new and
// unread since the last read is announced once.
let source: EventSource | null = null;
let known: Set<string> | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;

async function onChanged() {
  const list = await $queryClient.fetchQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list'],
    queryFn: () => api<NotificationView[]>('/api/notifications'),
    staleTime: 0,
  });
  if (known) {
    for (const notification of list) {
      if (!known.has(notification.id) && !notification.read) {
        toast.add({ title: message(notification), icon: 'i-lucide-bell', color: 'info', close: true });
      }
    }
  }
  known = new Set(list.map((n) => n.id));
  await $queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'count'] });
}

function connect() {
  source = new EventSource('/api/notifications/stream');
  source.addEventListener('changed', () => void onChanged());
  source.onerror = () => {
    // The browser reconnects by itself while the connection is merely lost. If
    // it gave up (the session ended, the service is down), ask the BFF: a 401
    // sends the person to the login screen (see useApi), anything else tries
    // again shortly.
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      retry = setTimeout(() => {
        api('/api/notifications/unread-count').then(connect, () => {});
      }, 5000);
    }
  };
}

onMounted(connect);
onBeforeUnmount(() => {
  source?.close();
  clearTimeout(retry);
});
</script>

<template>
  <UChip :show="(unread.data.value ?? 0) > 0" :text="unread.data.value" size="3xl" color="error">
    <UButton to="/notifications" color="neutral" variant="ghost" icon="i-lucide-bell" :aria-label="t('notifications.title')" data-testid="bell" />
  </UChip>
</template>

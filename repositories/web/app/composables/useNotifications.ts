import { useQuery } from '@tanstack/vue-query';
import type { NotificationView } from '~/types/api';

// What the bell and the notifications page share. TanStack Query holds the
// server's answers; the stream (see NotificationBell) only tells it when to ask again.
export const NOTIFICATIONS_KEY = ['notifications'] as const;

export function useNotifications() {
  const api = useApi();
  const { $queryClient } = useNuxtApp();
  const { t } = useI18n();
  const { user } = useSession();

  const unread = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'count'],
    queryFn: () => api<{ count: number }>('/api/notifications/unread-count'),
    select: (data) => data.count,
    // The layout reads this on the login screen too, where nobody is logged in.
    enabled: computed(() => !!user.value),
  });
  const list = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list'],
    queryFn: () => api<NotificationView[]>('/api/notifications'),
    enabled: computed(() => !!user.value),
  });

  const refresh = () => $queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  async function open(notification: NotificationView) {
    if (!notification.read) {
      await api(`/api/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'POST' });
      await refresh();
    }
    await navigateTo(notificationTarget(notification, user.value?.role ?? 'SELLER'));
  }

  async function readAll() {
    await api('/api/notifications/read-all', { method: 'POST' });
    await refresh();
  }

  // The sentence for a notification.
  function message(notification: NotificationView): string {
    const { clientTradeName, totalCents, reasonCode, reasonText } = notification.data;
    const reason = reasonCode === 'OTHER' ? (reasonText ?? '') : reasonCode ? t(`rejectionReasons.${reasonCode}`) : '';
    return t(`notifications.messages.${notification.kind}`, { client: clientTradeName, total: formatCents(totalCents), reason });
  }

  return { unread, list, refresh, open, readAll, message };
}

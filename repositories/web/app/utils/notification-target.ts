import type { NotificationView, Role } from '~/types/api';

// Where a notification leads: the supervisor opens the order in the analysis
// screen (which also shows an order that was already decided); the seller
// opens their own order.
export function notificationTarget(notification: Pick<NotificationView, 'orderId'>, role: Role): string {
  return role === 'SUPERVISOR' ? `/approvals/${notification.orderId}` : `/orders/${notification.orderId}`;
}

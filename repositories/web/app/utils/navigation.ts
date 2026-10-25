import type { Role } from '~/types/api';

// One list builds the menu: each entry says who sees it. `badge` names a count
// the layout knows how to show next to the entry.
export type NavBadge = 'unread' | 'pending';

export interface NavItem {
  key: string;
  icon: string;
  to: string;
  roles: Role[];
  badge?: NavBadge;
  // Other address prefixes that belong to this entry (its detail pages).
  also?: string[];
}

// The entry that is lit for a page: the page itself or one under it.
export function isActive(item: Pick<NavItem, 'to' | 'also'>, path: string): boolean {
  return [item.to, ...(item.also ?? [])].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', icon: 'i-lucide-layout-dashboard', to: '/home', roles: ['SELLER', 'SUPERVISOR'] },
  { key: 'clients', icon: 'i-lucide-store', to: '/clients', roles: ['SELLER'] },
  { key: 'catalog', icon: 'i-lucide-package-search', to: '/catalog', roles: ['SELLER', 'SUPERVISOR'] },
  { key: 'orders', icon: 'i-lucide-receipt-text', to: '/orders', roles: ['SELLER'] },
  { key: 'pending', icon: 'i-lucide-cloud-off', to: '/pending', roles: ['SELLER'], badge: 'pending' },
  { key: 'approvals', icon: 'i-lucide-clipboard-check', to: '/supervisor', roles: ['SUPERVISOR'], also: ['/approvals'] },
  { key: 'notifications', icon: 'i-lucide-bell', to: '/notifications', roles: ['SELLER', 'SUPERVISOR'], badge: 'unread' },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

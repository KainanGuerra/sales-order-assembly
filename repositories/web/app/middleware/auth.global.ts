import type { SessionUser } from '~/types/api';

export function homeFor(user: SessionUser): string {
  return user.role === 'SELLER' ? '/clients' : '/supervisor';
}

// undefined = not asked yet, null = nobody is logged in.
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useState<SessionUser | null | undefined>('user', () => undefined);

  if (user.value === undefined) {
    try {
      user.value = await $fetch<SessionUser>('/api/auth/me');
    } catch {
      user.value = null;
    }
  }

  if (to.path === '/') {
    return user.value ? navigateTo(homeFor(user.value)) : undefined;
  }
  if (!user.value) {
    return navigateTo('/');
  }
  // Each role only opens its own pages.
  const sellerPage = to.path.startsWith('/clients') || to.path.startsWith('/orders');
  if (user.value.role === 'SUPERVISOR' && sellerPage) {
    return navigateTo('/supervisor');
  }
  if (user.value.role === 'SELLER' && to.path.startsWith('/supervisor')) {
    return navigateTo('/clients');
  }
});

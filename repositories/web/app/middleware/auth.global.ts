import type { SessionUser } from '~/types/api';

export function homeFor(user: SessionUser): string {
  return '/home';
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
  // Each role only opens its own pages; /home, /catalog and /notifications are for both.
  const sellerPage = to.path.startsWith('/clients') || to.path.startsWith('/orders') || to.path.startsWith('/pending');
  const supervisorPage = to.path.startsWith('/supervisor') || to.path.startsWith('/approvals');
  if (user.value.role === 'SUPERVISOR' && sellerPage) {
    return navigateTo('/home');
  }
  if (user.value.role === 'SELLER' && supervisorPage) {
    return navigateTo('/home');
  }
});

import type { SessionUser } from '~/types/api';
import { classifyFailure } from '~/utils/connectivity';
import { homeFor } from '~/middleware/auth.global';

export function useSession() {
  const user = useState<SessionUser | null | undefined>('user', () => undefined);
  const api = useApi();
  const { $queryClient } = useNuxtApp();

  // What was kept on this phone for one person's session must not show up for the
  // next: the server-side answers the service worker keeps, what TanStack Query
  // holds and the products seen. The orders waiting to be sent are the exception
  // (they belong to a seller and are only ever sent by that seller).
  async function forgetSession() {
    $queryClient.clear();
    useSeenProductsStore().clear();
    try {
      await caches.delete('api-reads');
    } catch {
      // No Cache API (older browser, private window): nothing was kept there.
    }
  }

  async function login(role: SessionUser['role'], id: string) {
    await forgetSession();
    user.value = await $fetch<SessionUser>('/api/auth/login', { method: 'POST', body: { role, id } });
    await navigateTo(homeFor(user.value));
  }

  // Returns false when the server could not be reached. Leaving then would keep
  // the session alive on the server while the phone looks logged out, so the
  // seller stays logged in and is told to try with signal.
  async function logout(): Promise<boolean> {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      if (classifyFailure(error) === 'OFFLINE') {
        return false;
      }
      throw error;
    }
    user.value = null;
    await forgetSession();
    useOrderStore().reset();
    await navigateTo('/');
    return true;
  }

  return { user, login, logout };
}

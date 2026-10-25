import type { SessionUser } from '~/types/api';
import { homeFor } from '~/middleware/auth.global';

export function useSession() {
  const user = useState<SessionUser | null | undefined>('user', () => undefined);
  const api = useApi();
  const { $queryClient } = useNuxtApp();

  async function login(role: SessionUser['role'], id: string) {
    user.value = await $fetch<SessionUser>('/api/auth/login', { method: 'POST', body: { role, id } });
    await navigateTo(homeFor(user.value));
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    user.value = null;
    $queryClient.clear();
    useOrderStore().reset();
    await navigateTo('/');
  }

  return { user, login, logout };
}

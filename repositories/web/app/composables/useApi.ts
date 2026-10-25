import type { SessionUser } from '~/types/api';

// The $fetch every screen uses to talk to the BFF. If the session has ended
// (it expires, or the server restarted), the visitor goes back to the login
// screen instead of seeing a broken page. The draft is kept, so after logging
// in again the seller finds the order where they left it.
export function useApi() {
  const user = useState<SessionUser | null | undefined>('user', () => undefined);
  const { $queryClient } = useNuxtApp();

  return $fetch.create({
    onResponseError({ response }) {
      if (response.status === 401) {
        user.value = null;
        // What was fetched for this person must not be shown to the next one.
        $queryClient.clear();
        void navigateTo('/');
      }
    },
  });
}

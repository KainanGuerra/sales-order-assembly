import type { SessionUser } from '~/types/api';
import { REQUEST_TIMEOUT_MS } from '~/utils/connectivity';

// The $fetch every screen uses to talk to the BFF. If the session has ended
// (it expires, or the server restarted), the visitor goes back to the login
// screen instead of seeing a broken page. The draft is kept, so after logging
// in again the seller finds the order where they left it. A request that gets
// no answer in time counts as "no signal" (see useConnectivity).
export function useApi() {
  const user = useState<SessionUser | null | undefined>('user', () => undefined);
  const { $queryClient } = useNuxtApp();
  const { markOnline, markOffline } = useConnectivity();

  return $fetch.create({
    timeout: REQUEST_TIMEOUT_MS,
    onRequestError() {
      markOffline();
    },
    onResponse() {
      markOnline();
    },
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

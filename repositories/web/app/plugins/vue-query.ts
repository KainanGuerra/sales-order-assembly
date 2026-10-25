import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';

// TanStack Query holds what comes from the server (search results, the
// calculation); Pinia holds only what the seller typed.
export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  });
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
  // Exposed so a session that ends can empty the cache (see useApi, useSession).
  return { provide: { queryClient } };
});

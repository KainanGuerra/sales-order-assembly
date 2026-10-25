import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { Calculation } from '~/types/api';

// Asks the backend, after each edit, what the order is worth and whether it
// can be sent. The key is the draft itself, so an answer for an older draft is
// never shown in place of a newer one.
export function useCalculation() {
  const order = useOrderStore();
  const api = useApi();
  const request = computed(() => order.request);
  const settled = useDebouncedValue(request, 300);

  // Without signal there is no one to ask: the screen keeps the last answer,
  // marked as out of date, and asks again when the signal returns.
  const { online } = useConnectivity();
  const enabled = computed(() => online.value && settled.value.clientId !== '' && settled.value.items.length > 0);

  const query = useQuery({
    queryKey: ['calculate', settled],
    queryFn: () => api<Calculation>('/api/orders/calculate', { method: 'POST', body: settled.value }),
    enabled,
    // Keep showing the last totals while the next ones load.
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  // True while the screen shows numbers for a draft that is no longer the one on screen.
  const isStale = computed(
    () => JSON.stringify(request.value) !== JSON.stringify(settled.value) || query.isFetching.value,
  );

  return { ...query, isStale };
}

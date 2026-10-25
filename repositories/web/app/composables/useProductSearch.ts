import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import type { ProductSearchItem } from '~/types/api';
import { classifyFailure } from '~/utils/connectivity';

// Online, the answer is the server's. Without signal (or if the server cannot be
// reached) the answer comes from the products already seen for this client,
// and `fromPhone` tells the screen so.
export function useProductSearch(clientId: Ref<string>, text: Ref<string>) {
  const api = useApi();
  const seen = useSeenProductsStore();
  const { online } = useConnectivity();
  const settled = useDebouncedValue(text, 300);
  const enabled = computed(() => settled.value.trim().length >= 2);

  return useQuery({
    queryKey: ['products', clientId, settled, online],
    queryFn: async (): Promise<{ items: ProductSearchItem[]; fromPhone: boolean }> => {
      const fromPhone = () => ({ items: seen.search(clientId.value, settled.value), fromPhone: true });
      if (!online.value) {
        return fromPhone();
      }
      try {
        const found = await api<{ items: ProductSearchItem[] }>(`/api/clients/${encodeURIComponent(clientId.value)}/products`, {
          query: { q: settled.value.trim() },
        });
        seen.remember(clientId.value, found.items);
        return { items: found.items, fromPhone: false };
      } catch (error) {
        if (classifyFailure(error) === 'OFFLINE') {
          return fromPhone();
        }
        throw error;
      }
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

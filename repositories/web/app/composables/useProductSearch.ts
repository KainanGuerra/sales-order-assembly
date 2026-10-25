import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import type { ProductSearchItem } from '~/types/api';

export function useProductSearch(clientId: Ref<string>, text: Ref<string>) {
  const api = useApi();
  const settled = useDebouncedValue(text, 300);
  const enabled = computed(() => settled.value.trim().length >= 2);

  return useQuery({
    queryKey: ['products', clientId, settled],
    queryFn: () =>
      api<{ items: ProductSearchItem[] }>(`/api/clients/${encodeURIComponent(clientId.value)}/products`, {
        query: { q: settled.value.trim() },
      }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

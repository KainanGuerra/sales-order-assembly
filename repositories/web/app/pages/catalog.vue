<script setup lang="ts">
import type { ClientView, ProductSearchItem } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('catalog.title') });
const api = useApi();
const route = useRoute();
const { user } = useSession();

const PAGE = 20;
const NONE = 'NONE';
const isSeller = computed(() => user.value?.role === 'SELLER');

// Only a seller has clients; the supervisor sees the standard table.
const clients = isSeller.value ? await useFetch<{ items: ClientView[] }>('/api/clients', { $fetch: api }) : null;
const clientOptions = computed(() => [
  { label: t('catalog.allClients'), value: NONE },
  ...(clients?.data.value?.items ?? []).map((c) => ({ label: c.tradeName, value: c.id })),
]);

// The client lives in the address, so "Ver produtos" on a client card lands here already filtered.
const clientId = ref<string>(typeof route.query.clientId === 'string' ? route.query.clientId : NONE);
const text = ref('');
const settled = useDebouncedValue(text, 300);
const client = computed(() => clients?.data.value?.items.find((c) => c.id === clientId.value));

const items = ref<ProductSearchItem[]>([]);
const loading = ref(false);
const failed = ref(false);
const exhausted = ref(false);

async function load(reset: boolean) {
  if (reset) {
    items.value = [];
    exhausted.value = false;
  }
  loading.value = true;
  failed.value = false;
  try {
    const q = settled.value.trim();
    const page = await api<{ items: ProductSearchItem[] }>('/api/catalog', {
      query: {
        q: q.length >= 2 ? q : undefined,
        clientId: clientId.value === NONE ? undefined : clientId.value,
        limit: PAGE,
        offset: q.length >= 2 ? undefined : items.value.length,
      },
    });
    items.value = reset || q.length >= 2 ? page.items : [...items.value, ...page.items];
    // A search is one page; browsing ends with a short page.
    exhausted.value = q.length >= 2 || page.items.length < PAGE;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

watch([settled, clientId], () => {
  void load(true);
  void navigateTo({ path: '/catalog', query: clientId.value === NONE ? {} : { clientId: clientId.value } }, { replace: true });
}, { immediate: true });
</script>

<template>
  <div class="space-y-3 pt-2">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('catalog.title') }}</h1>
      <p class="text-sm text-neutral-500">{{ t('catalog.subtitle') }}</p>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField v-if="isSeller" :label="t('catalog.client')" class="w-full sm:w-72">
        <USelect v-model="clientId" :items="clientOptions" class="w-full" data-testid="catalog-client" />
      </UFormField>
      <UInput v-model="text" icon="i-lucide-search" :placeholder="t('catalog.search')" class="min-w-0 flex-1" data-testid="catalog-search" />
      <UButton v-if="client" :to="`/orders/new/${client.id}`" icon="i-lucide-shopping-cart" :label="t('catalog.newOrder')" />
    </div>

    <p class="text-sm text-neutral-500" data-testid="catalog-table">
      {{ client ? t('catalog.priceTable', { name: client.tradeName }) : t('catalog.standardTable') }}
      <UBadge v-if="client?.priceTableFallback" color="warning" variant="subtle" size="sm" class="ml-1">{{ t('clients.fallback') }}</UBadge>
    </p>

    <UAlert v-if="failed" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('catalog.failed')" />
    <p v-else-if="!loading && !items.length" class="text-neutral-500" data-testid="catalog-empty">{{ t('catalog.empty') }}</p>

    <div class="space-y-2">
      <div
        v-for="product in items"
        :key="product.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
        :class="{ 'opacity-60': product.availability !== 'AVAILABLE' }"
        data-testid="catalog-product"
      >
        <div class="min-w-0">
          <p class="truncate font-medium">{{ product.description }}</p>
          <p class="text-xs text-neutral-500">{{ product.sku }} · {{ product.ean }}</p>
          <p v-if="product.packFactor > 1" class="text-xs text-neutral-500">
            {{ product.multipleOnly ? t('order.packOnly', { n: product.packFactor }) : `${product.packFactor} un./emb.` }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p v-if="product.unitPriceCents !== null" class="font-semibold">{{ formatCents(product.unitPriceCents) }} <span class="text-xs font-normal text-neutral-500">/ un.</span></p>
          <UBadge v-else-if="product.reason" color="warning" variant="subtle" size="sm">{{ t(`availability.${product.reason}`) }}</UBadge>
        </div>
      </div>
      <USkeleton v-if="loading && !items.length" v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <div v-if="!exhausted && items.length" class="flex justify-center">
      <UButton color="neutral" variant="outline" :loading="loading" :label="t('catalog.more')" data-testid="catalog-more" @click="load(false)" />
    </div>
  </div>
</template>

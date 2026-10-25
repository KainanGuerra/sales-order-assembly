<script setup lang="ts">
import type { ClientView, ProductSearchItem } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('catalog.title') });
const api = useApi();
const route = useRoute();
const { user } = useSession();
const order = useOrderStore();
const calculation = useCalculation();

const PAGE = 20;
const NONE = 'NONE';
const isSeller = computed(() => user.value?.role === 'SELLER');

// Only a seller has clients (and a cart); the supervisor sees the standard table.
const clients = isSeller.value ? await useFetch<{ items: ClientView[] }>('/api/clients', { $fetch: api }) : null;
const clientOptions = computed(() => [
  { label: t('catalog.allClients'), value: NONE },
  ...(clients?.data.value?.items ?? []).map((c) => ({ label: c.tradeName, value: c.id })),
]);

const clientId = ref<string>(NONE);
const text = ref('');
const settled = useDebouncedValue(text, 300);
const client = computed(() => clients?.data.value?.items.find((c) => c.id === clientId.value));

// The cart is the order draft, and a draft belongs to one client: the price comes
// from that client's table. Choosing another client while the cart has items asks
// first, then empties it.
const switchOpen = ref(false);
const switchTo = ref<string>(NONE);

function apply(next: string) {
  clientId.value = next;
  if (next !== NONE) {
    order.start(next);
  }
}

function chooseClient(next: string) {
  if (next !== NONE && order.conflictsWith(next)) {
    switchTo.value = next;
    switchOpen.value = true;
    return;
  }
  apply(next);
}

function confirmSwitch() {
  order.reset();
  apply(switchTo.value);
  switchOpen.value = false;
}

// Arriving from "Ver produtos" on a client card.
const fromAddress = typeof route.query.clientId === 'string' ? route.query.clientId : NONE;
if (clients?.data.value?.items.some((c) => c.id === fromAddress)) {
  chooseClient(fromAddress);
}

const cartVisible = computed(() => isSeller.value && clientId.value !== NONE && order.clientId === clientId.value);
const lineOf = (productId: string) => (cartVisible.value ? order.lines.find((l) => l.productId === productId) : undefined);

// Narrow screens: a bar above the footer that opens the cart as a sheet.
const sheetOpen = ref(false);

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
        <USelect :model-value="clientId" :items="clientOptions" class="w-full" data-testid="catalog-client" @update:model-value="chooseClient" />
      </UFormField>
      <UInput v-model="text" icon="i-lucide-search" :placeholder="t('catalog.search')" class="min-w-0 flex-1" data-testid="catalog-search" />
      <UButton v-if="client" :to="`/orders/new/${client.id}`" color="neutral" variant="outline" icon="i-lucide-shopping-cart" :label="t('catalog.newOrder')" />
    </div>

    <p class="text-sm text-neutral-500" data-testid="catalog-table">
      {{ client ? t('catalog.priceTable', { name: client.tradeName }) : t('catalog.standardTable') }}
      <UBadge v-if="client?.priceTableFallback" color="warning" variant="subtle" size="sm" class="ml-1">{{ t('clients.fallback') }}</UBadge>
    </p>
    <UAlert v-if="isSeller && clientId === NONE" color="info" variant="subtle" icon="i-lucide-info" :title="t('cart.chooseClient')" data-testid="choose-client" />

    <div class="grid gap-4" :class="cartVisible ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''">
      <div class="min-w-0 space-y-3">
        <UAlert v-if="failed" role="alert" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('catalog.failed')" />
        <p v-else-if="!loading && !items.length" class="text-neutral-500" data-testid="catalog-empty">{{ t('catalog.empty') }}</p>

        <div class="space-y-2">
          <ProductResult
            v-for="product in items"
            :key="product.id"
            :product="product"
            :added="!!lineOf(product.id)"
            :line="lineOf(product.id)"
            :locked="!cartVisible"
            @add="order.addProduct(product)"
            @remove="order.removeLine(product.id)"
            @set-quantity="order.setQuantity(product.id, $event)"
            @set-unit="order.setUnit(product.id, $event)"
          />
          <template v-if="loading && !items.length">
            <USkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
          </template>
        </div>

        <div v-if="!exhausted && items.length" class="flex justify-center">
          <UButton color="neutral" variant="outline" :loading="loading" :label="t('catalog.more')" data-testid="catalog-more" @click="load(false)" />
        </div>
      </div>

      <!-- Wide screens: the cart beside the list. -->
      <aside v-if="cartVisible" class="sticky top-[4.5rem] hidden max-h-[calc(100dvh-9rem)] self-start overflow-y-auto lg:block" data-testid="cart-side">
        <CartPanel :client-name="client?.tradeName" />
      </aside>
    </div>

    <!-- Narrow screens: a bar above the footer, and the cart as a sheet between the header and the footer. -->
    <template v-if="cartVisible">
      <div class="fixed bottom-11 left-[var(--menu-w,0px)] right-0 z-20 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white p-3 shadow-lg lg:hidden dark:border-neutral-800 dark:bg-neutral-900" data-testid="cart-bar">
        <div class="min-w-0 text-sm">
          <p class="font-medium">{{ t('cart.itemCount', { n: order.lines.length }, order.lines.length) }}</p>
          <p v-if="calculation.data.value && !order.isEmpty" class="text-neutral-500">{{ formatCents(calculation.data.value.totalCents) }}</p>
        </div>
        <UButton icon="i-lucide-shopping-cart" :label="t('cart.open')" data-testid="cart-open" @click="sheetOpen = true" />
      </div>
      <div v-if="sheetOpen" class="fixed bottom-11 left-[var(--menu-w,0px)] right-0 top-14 z-[35] overflow-y-auto bg-neutral-50 p-4 lg:hidden dark:bg-neutral-950" data-testid="cart-sheet">
        <div class="mb-3 flex justify-end">
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-x" :label="t('cart.hide')" data-testid="cart-hide" @click="sheetOpen = false" />
        </div>
        <CartPanel :client-name="client?.tradeName" />
      </div>
    </template>

    <UModal v-model:open="switchOpen" :title="t('cart.switchTitle')" :description="t('cart.switchBody')">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" :label="t('cart.cancel')" data-testid="switch-cancel" @click="switchOpen = false" />
          <UButton color="error" :label="t('cart.switchConfirm')" data-testid="switch-confirm" @click="confirmSwitch" />
        </div>
      </template>
    </UModal>
  </div>
</template>

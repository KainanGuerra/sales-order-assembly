<script setup lang="ts">
import type { ClientView, PendingOrder } from '~/types/api';

const { t } = useI18n();
useHead({ title: t('home.title') });
const api = useApi();
const { user } = useSession();
const pending = usePendingStore();
const { unread } = useNotifications();

const isSeller = computed(() => user.value?.role === 'SELLER');
// Counts are a convenience: a failed read just shows a dash.
const clients = isSeller.value ? await useFetch<{ items: ClientView[] }>('/api/clients', { $fetch: api }) : null;
const approvals = isSeller.value ? null : await useFetch<{ items: PendingOrder[] }>('/api/approvals', { $fetch: api });

const cards = computed(() =>
  isSeller.value
    ? [
        { key: 'clients', icon: 'i-lucide-store', to: '/clients', count: clients?.data.value?.items.length },
        { key: 'orders', icon: 'i-lucide-receipt-text', to: '/orders' },
        { key: 'catalog', icon: 'i-lucide-package-search', to: '/catalog' },
        { key: 'pending', icon: 'i-lucide-cloud-off', to: '/pending', count: user.value ? pending.of(user.value.id).length : 0 },
        { key: 'unread', icon: 'i-lucide-bell', to: '/notifications', count: unread.data.value },
      ]
    : [
        { key: 'approvals', icon: 'i-lucide-clipboard-check', to: '/supervisor', count: approvals?.data.value?.items.length },
        { key: 'catalog', icon: 'i-lucide-package-search', to: '/catalog' },
        { key: 'unread', icon: 'i-lucide-bell', to: '/notifications', count: unread.data.value },
      ],
);
</script>

<template>
  <div class="space-y-4 pt-2">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('home.greeting', { name: user?.name ?? '' }) }}</h1>
      <p class="text-sm text-neutral-500">{{ t('home.subtitle') }}</p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink v-for="card in cards" :key="card.key" :to="card.to" :data-testid="`home-${card.key}`" class="block">
        <UCard class="h-full transition hover:ring-2 hover:ring-primary">
          <div class="flex items-center gap-3">
            <span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <UIcon :name="card.icon" class="size-5" />
            </span>
            <div class="min-w-0">
              <p class="font-medium">{{ t(`home.${card.key}`) }}</p>
              <p v-if="'count' in card" class="text-2xl font-semibold" :data-testid="`count-${card.key}`">{{ card.count ?? '–' }}</p>
              <p v-else class="text-sm text-neutral-500">{{ t('home.open') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>

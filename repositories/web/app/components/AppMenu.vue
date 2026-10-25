<script setup lang="ts">
import { isActive } from '~/utils/navigation';

export interface MenuEntry {
  key: string;
  label: string;
  icon: string;
  to: string;
  also?: string[];
  badge?: string;
}

defineProps<{ items: MenuEntry[] }>();
const route = useRoute();
</script>

<template>
  <nav class="flex flex-col gap-1" data-testid="menu">
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      :data-testid="`menu-${item.key}`"
      :aria-current="isActive(item, route.path) ? 'page' : undefined"
      class="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition hover:translate-x-0.5 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
      :class="{ 'bg-primary/10 font-semibold text-primary shadow-[inset_3px_0_0_var(--ui-primary)] dark:text-primary': isActive(item, route.path) }"
    >
      <span
        class="grid size-7 shrink-0 place-items-center rounded-lg transition"
        :class="isActive(item, route.path) ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:group-hover:bg-neutral-700'"
      >
        <UIcon :name="item.icon" class="size-4" />
      </span>
      <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
      <UBadge v-if="item.badge" color="primary" variant="solid" size="sm">{{ item.badge }}</UBadge>
    </NuxtLink>
  </nav>
</template>

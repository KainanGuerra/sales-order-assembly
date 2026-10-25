<script setup lang="ts">
import type { MenuEntry } from '~/components/AppMenu.vue';
import type { NavBadge } from '~/utils/navigation';

const MENU_KEY = 'sales.menu-open';
// Where the menu stops being a drawer and becomes a column beside the page (Tailwind's "md").
const DESKTOP_QUERY = '(min-width: 768px)';

const { t } = useI18n();
const { user, logout } = useSession();
const toast = useToast();
const route = useRoute();
const { online } = useConnectivity();
const { mode, chromeDark, cycle } = useAppTheme();
const { unread } = useNotifications();
const version = `v${useRuntimeConfig().public.appVersion}`;
const pendingOrders = usePendingStore();
const waiting = computed(() => (user.value ? pendingOrders.of(user.value.id).length : 0));
// Sends what was left waiting whenever the signal is back (see usePendingSync).
useAutoSync();

// Like the reference apps: on a wide screen the menu is a column that starts
// open and the hamburger opens and closes it; on a narrow one it is a drawer
// that starts closed. The wide-screen choice is remembered.
// The app has no server-side render, so the screen and the storage can be read
// right here and the first paint is already right.
const wide = import.meta.client ? window.matchMedia(DESKTOP_QUERY) : null;
const isDesktop = ref(wide?.matches ?? true);
const drawerOpen = ref(false);
const desktopOpen = ref(remembered());

function remembered(): boolean {
  try {
    return localStorage.getItem(MENU_KEY) !== 'closed';
  } catch {
    return true; // Storage unavailable: start open.
  }
}

onMounted(() => {
  wide?.addEventListener('change', (event) => {
    isDesktop.value = event.matches;
    drawerOpen.value = false;
  });
});

function toggleMenu() {
  if (!isDesktop.value) {
    drawerOpen.value = !drawerOpen.value;
    return;
  }
  desktopOpen.value = !desktopOpen.value;
  try {
    localStorage.setItem(MENU_KEY, desktopOpen.value ? 'open' : 'closed');
  } catch {
    // Not remembered; it still works for this visit.
  }
}
const menuShown = computed(() => (isDesktop.value ? desktopOpen.value : drawerOpen.value));

// A page was chosen: close the drawer.
watch(() => route.path, () => {
  drawerOpen.value = false;
});

const themeIcon = computed(() => ({ light: 'i-lucide-sun', mixed: 'i-lucide-contrast', dark: 'i-lucide-moon' })[mode.value]);
const initials = computed(() =>
  (user.value?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join(''),
);

function badgeOf(badge: NavBadge | undefined): string | undefined {
  const count = badge === 'unread' ? (unread.data.value ?? 0) : badge === 'pending' ? waiting.value : 0;
  return count > 0 ? String(count) : undefined;
}

const items = computed<MenuEntry[]>(() =>
  user.value
    ? navFor(user.value.role).map((item) => ({
        key: item.key,
        label: t(`nav.${item.key}`),
        icon: item.icon,
        to: item.to,
        also: item.also,
        badge: badgeOf(item.badge),
      }))
    : [],
);

async function leave() {
  if (!(await logout())) {
    toast.add({ title: t('offline.logoutNeedsSignal'), color: 'warning', icon: 'i-lucide-wifi-off' });
  }
}
</script>

<template>
  <!-- Header and footer are fixed on every page. The login screen never scrolls: it
       is exactly the screen between them (see pages/index.vue). -->
  <div class="flex flex-col bg-neutral-50 dark:bg-neutral-950" :class="user ? 'min-h-dvh' : 'h-dvh overflow-hidden'">
    <!-- "dark" on the header and the menu darkens just them in the mixed look. -->
    <header
      class="fixed inset-x-0 top-0 z-30 h-14 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
      :class="{ dark: chromeDark }"
    >
      <div class="flex h-full items-center justify-between gap-3 px-4">
        <div class="flex items-center gap-2">
          <UButton
            v-if="user"
            color="neutral"
            variant="ghost"
            icon="i-lucide-menu"
            :aria-label="menuShown ? t('nav.close') : t('nav.open')"
            :aria-expanded="menuShown"
            data-testid="menu-button"
            @click="toggleMenu"
          />
          <NuxtLink to="/" class="text-neutral-900 dark:text-white" :aria-label="t('app.title')">
            <AppLogo />
          </NuxtLink>
          <!-- Logged out, the menu is not there to carry it. -->
          <UBadge v-if="!user" color="neutral" variant="subtle" size="sm" data-testid="version-header">{{ version }}</UBadge>
        </div>
        <div class="flex items-center gap-1 text-sm">
          <UTooltip :text="t(`theme.${mode}`)">
            <UButton color="neutral" variant="ghost" :icon="themeIcon" :aria-label="t(`theme.${mode}`)" data-testid="theme-button" @click="cycle" />
          </UTooltip>
          <template v-if="user">
            <NotificationBell />
            <UAvatar :text="initials" size="sm" :alt="user.name" class="ml-1" />
            <span class="hidden max-w-40 truncate text-neutral-600 sm:inline dark:text-neutral-300">{{ user.name }}</span>
            <UTooltip :text="t('app.logout')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" :aria-label="t('app.logout')" data-testid="logout" @click="leave" />
            </UTooltip>
          </template>
        </div>
      </div>
    </header>

    <!-- The menu always starts under the header, so the hamburger stays in view:
         a column beside the page on wide screens, a drawer over it on narrow ones. -->
    <aside
      v-if="user"
      class="fixed bottom-11 left-0 top-14 z-[25] flex w-60 flex-col overflow-y-auto border-r border-neutral-200 bg-white p-3 transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-900"
      :class="[{ dark: chromeDark }, menuShown ? 'translate-x-0' : '-translate-x-full']"
      :aria-label="t('nav.description')"
      :inert="!menuShown"
      @keydown.esc="drawerOpen = false"
    >
      <AppMenu :items="items" />
      <p class="mt-auto pt-4 text-center text-xs text-neutral-400 dark:text-neutral-500" data-testid="version-menu">{{ t('app.title') }} {{ version }}</p>
    </aside>
    <div v-if="user && !isDesktop && drawerOpen" class="fixed inset-x-0 bottom-11 top-14 z-10 bg-black/40" aria-hidden="true" data-testid="menu-backdrop" @click="drawerOpen = false" />

    <div class="flex min-h-0 flex-1 flex-col pb-11 pt-14 transition-[padding] duration-200" :class="{ 'md:pl-60': user && desktopOpen }">
      <UContainer class="w-full flex-1 py-4" :class="user ? 'pb-40' : 'overflow-y-auto'">
        <ConnectionBanner class="mb-3" />
        <slot />
      </UContainer>

      <footer class="fixed inset-x-0 bottom-0 z-30 h-11 border-t border-neutral-200 bg-white/90 text-sm text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-400" :class="{ dark: chromeDark }">
        <UContainer class="flex h-full items-center justify-between gap-3">
          <span>{{ t('app.title') }} {{ version }} · {{ t('footer.madeBy') }}</span>
          <span v-if="!user" class="flex items-center gap-3" data-testid="contacts">
            <a v-for="contact in CONTACTS" :key="contact.key" :href="contact.href" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 hover:text-primary" :data-testid="`contact-${contact.key}`">
              <UIcon :name="contact.icon" class="size-4" />
              {{ t(`footer.${contact.key}`) }}
            </a>
          </span>
          <span class="flex items-center gap-1.5" data-testid="footer-connection">
            <span class="size-2 rounded-full" :class="online ? 'bg-emerald-500' : 'bg-amber-500'" />
            {{ online ? t('footer.online') : t('footer.offline') }}
          </span>
        </UContainer>
      </footer>
    </div>
  </div>
</template>

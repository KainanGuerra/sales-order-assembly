import { darkChrome, nextMode, pageScheme, THEME_KEY, type ThemeMode } from '~/utils/theme';

// The look the person picked. The page body follows Nuxt UI's color mode;
// "mixed" is that mode set to light plus a dark header and menu (see the layout).
// The choice is read at start by plugins/theme.client.ts.
export function useAppTheme() {
  const mode = useState<ThemeMode>('theme-mode', () => 'light');
  const colorMode = useColorMode();

  function apply(next: ThemeMode) {
    mode.value = next;
    colorMode.preference = pageScheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not saved; the look still changes for this visit.
    }
  }

  return {
    mode,
    chromeDark: computed(() => darkChrome(mode.value)),
    apply,
    cycle: () => apply(nextMode(mode.value)),
  };
}

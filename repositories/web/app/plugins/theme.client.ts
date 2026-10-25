import { initialMode, THEME_KEY } from '~/utils/theme';

// Picks the look before the first screen is drawn (the app has no server-side
// render), so there is no flash of the wrong one.
export default defineNuxtPlugin(() => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    // Storage unavailable: follow the device.
  }
  useAppTheme().apply(initialMode(saved, window.matchMedia('(prefers-color-scheme: dark)').matches));
});

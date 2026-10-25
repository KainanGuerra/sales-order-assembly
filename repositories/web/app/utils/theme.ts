// Three looks: light, dark, and mixed (dark header and menu over a light page).
export const THEME_MODES = ['light', 'mixed', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_KEY = 'sales.theme-mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode);
}

// The button cycles light -> mixed -> dark -> light.
export function nextMode(mode: ThemeMode): ThemeMode {
  return THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length]!;
}

// What the page body follows. Only "dark" darkens the page; "mixed" keeps it light.
export function pageScheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'dark' ? 'dark' : 'light';
}

// Whether the header and the menu are dark.
export function darkChrome(mode: ThemeMode): boolean {
  return mode !== 'light';
}

// The saved choice if it is valid; otherwise the device's preference.
export function initialMode(saved: string | null, prefersDark: boolean): ThemeMode {
  if (isThemeMode(saved)) {
    return saved;
  }
  return prefersDark ? 'dark' : 'light';
}

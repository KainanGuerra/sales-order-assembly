import { describe, expect, it } from 'vitest';
import { darkChrome, initialMode, nextMode, pageScheme } from '~/utils/theme';

describe('theme modes', () => {
  it('cycles light, mixed, dark and back to light', () => {
    expect(nextMode('light')).toBe('mixed');
    expect(nextMode('mixed')).toBe('dark');
    expect(nextMode('dark')).toBe('light');
  });

  it('darkens the page only in dark mode', () => {
    expect(pageScheme('light')).toBe('light');
    expect(pageScheme('mixed')).toBe('light');
    expect(pageScheme('dark')).toBe('dark');
  });

  it('darkens the header and menu in mixed and dark, not in light', () => {
    expect(darkChrome('light')).toBe(false);
    expect(darkChrome('mixed')).toBe(true);
    expect(darkChrome('dark')).toBe(true);
  });

  it('uses the saved choice, and the device preference when nothing valid is saved', () => {
    expect(initialMode('mixed', true)).toBe('mixed');
    expect(initialMode(null, true)).toBe('dark');
    expect(initialMode('nonsense', false)).toBe('light');
  });
});

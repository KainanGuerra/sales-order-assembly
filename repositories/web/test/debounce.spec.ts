import { effectScope, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '../app/utils/debounce';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows the source only after it stopped changing', async () => {
    const scope = effectScope();
    const source = ref('a');
    const debounced = scope.run(() => useDebouncedValue(source, 300))!;

    source.value = 'ab';
    await nextTick();
    vi.advanceTimersByTime(200);
    source.value = 'abc';
    await nextTick();
    vi.advanceTimersByTime(200);
    expect(debounced.value).toBe('a');

    vi.advanceTimersByTime(100);
    expect(debounced.value).toBe('abc');
    scope.stop();
  });

  it('notices a change deep inside an object', async () => {
    const scope = effectScope();
    const source = ref({ items: [{ quantity: 1 }] });
    const debounced = scope.run(() => useDebouncedValue(source, 300))!;

    source.value.items[0].quantity = 2;
    await nextTick();
    vi.advanceTimersByTime(300);
    expect(debounced.value.items[0].quantity).toBe(2);
    scope.stop();
  });

  it('stops the pending update when its scope ends', async () => {
    const scope = effectScope();
    const source = ref('a');
    const debounced = scope.run(() => useDebouncedValue(source, 300))!;

    source.value = 'b';
    await nextTick();
    scope.stop();
    vi.advanceTimersByTime(1000);
    expect(debounced.value).toBe('a');
  });
});

import { onScopeDispose, ref, watch, type Ref } from 'vue';

// A copy of `source` that follows it only after it stopped changing for `ms`.
export function useDebouncedValue<T>(source: Ref<T>, ms: number): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    source,
    (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        debounced.value = value;
      }, ms);
    },
    { deep: true },
  );
  onScopeDispose(() => clearTimeout(timer));

  return debounced;
}

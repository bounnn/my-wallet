import { liveQuery } from "dexie";

/**
 * Reactive Dexie query: re-runs whenever the queried tables change
 * or any reactive source read inside `querier` (before its first await) changes.
 */
export function useLiveQuery<T>(querier: () => T | Promise<T>, initialValue?: T) {
  const value = shallowRef<T | undefined>(initialValue);
  const error = shallowRef<unknown>();

  watchEffect((onCleanup) => {
    const subscription = liveQuery(querier).subscribe({
      next: (result) => {
        value.value = result;
        error.value = undefined;
      },
      error: (err) => {
        error.value = err;
      },
    });
    onCleanup(() => subscription.unsubscribe());
  });

  return { value, error };
}

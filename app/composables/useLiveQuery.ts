import { liveQuery } from "dexie";

/**
 * Reactive Dexie query: re-runs whenever the queried tables change.
 * Don't read props or refs inside `querier`: Dexie may run it outside Vue's tracking, so it won't re-run when
 * they change. Query the whole table and filter in a computed instead (see GoalMoneyModal's wallet).
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

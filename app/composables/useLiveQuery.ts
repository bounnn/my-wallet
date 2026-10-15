import { liveQuery } from "dexie";
import type { WatchSource } from "vue";

/**
 * Reactive Dexie query: re-runs whenever the queried tables change.
 * A query that reads props or refs lists them in `deps`, so it also re-runs when they change
 * (Dexie runs `querier` outside Vue's tracking, so reading them inside isn't enough):
 *   useLiveQuery(() => db.budgets.where("month").equals(props.month).toArray(), [], () => props.month)
 */
export function useLiveQuery<T>(querier: () => T | Promise<T>, initialValue?: T, deps?: WatchSource) {
  const value = shallowRef<T | undefined>(initialValue);
  const error = shallowRef<unknown>();

  function subscribe() {
    const subscription = liveQuery(querier).subscribe({
      next: (result) => {
        value.value = result;
        error.value = undefined;
      },
      error: (err) => {
        error.value = err;
      },
    });
    return () => subscription.unsubscribe();
  }

  if (deps) watch(deps, (_value, _old, onCleanup) => onCleanup(subscribe()), { immediate: true });
  else onScopeDispose(subscribe());

  return { value, error };
}

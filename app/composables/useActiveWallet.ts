import type { Ref } from "vue";
import type { Account } from "~/utils/db";

const STORAGE_KEY = "my-wallet-active-wallet";

/**
 * The wallet home shows, picked in its header; new transactions start on it too.
 * Remembered on this device; falls back to the main (first) wallet when none is picked or it was deleted.
 */
export function useActiveWallet(wallets: Ref<Account[] | undefined>) {
  const id = useState<number | undefined>("active-wallet", () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Number(saved) : undefined;
    } catch {
      return undefined;
    }
  });

  const wallet = computed(() => wallets.value?.find((w) => w.id === id.value) ?? wallets.value?.[0]);

  function pick(w: Account) {
    id.value = w.id;
    try {
      localStorage.setItem(STORAGE_KEY, String(w.id));
    } catch {}
  }

  return { wallet, pick };
}

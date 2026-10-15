<script setup lang="ts">
// Settings: wallets, categories, backup / restore, and erasing everything. All data is on this device only.
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);

const toast = useToast();
const showError = (title: string, error: unknown) =>
  toast.add({
    title,
    description: error instanceof Error ? error.message : String(error),
    color: "error",
    icon: "i-lucide-circle-alert",
  });

// --- Wallets: each with its current balance; the one home, report and plan show is marked ---

const { wallet: activeWallet } = useActiveWallet(wallets);

const walletRows = computed(() =>
  (wallets.value ?? []).map((w) => ({
    wallet: w,
    balance:
      w.initialBalance +
      (transactions.value ?? [])
        .filter((t) => t.accountId === w.id)
        .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0),
  })),
);

const walletModalOpen = ref(false);
const editingWallet = shallowRef<Account>();
function openWallet(wallet?: Account) {
  editingWallet.value = wallet;
  walletModalOpen.value = true;
}

// --- Categories by type; goals' categories are edited on the plan page, deleted ones are hidden ---

const categoryTypes = [
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
];
const categoryType = ref<Category["type"]>("expense");
const typeCategories = computed(() => {
  const goalCategories = new Set((goals.value ?? []).map((g) => g.categoryId));
  return (categories.value ?? []).filter(
    (c) => c.type === categoryType.value && !c.archived && !goalCategories.has(c.id),
  );
});

const categoryModalOpen = ref(false);
const editingCategory = shallowRef<Category>();
function openCategory(category?: Category) {
  editingCategory.value = category;
  categoryModalOpen.value = true;
}

// --- Backup: remembered per device so the row can nudge when it's been a while ---

const LAST_BACKUP_KEY = "my-wallet-last-backup";
const lastBackup = ref<Date>();
onMounted(() => {
  try {
    const saved = localStorage.getItem(LAST_BACKUP_KEY);
    if (saved) lastBackup.value = new Date(saved);
  } catch {}
});
const lastBackupLabel = computed(() => {
  if (!lastBackup.value) return "Save a file with all your data";
  const day = dayLabel(lastBackup.value);
  return day === formatDate(lastBackup.value) ? `Last backup on ${day}` : `Last backup ${day.toLowerCase()}`;
});

const backingUp = ref(false);
async function backUp() {
  backingUp.value = true;
  try {
    if (!(await saveBackup())) return;
    lastBackup.value = new Date();
    try {
      localStorage.setItem(LAST_BACKUP_KEY, lastBackup.value.toISOString());
    } catch {}
    toast.add({ title: "Backup saved", description: "Keep the file somewhere safe", icon: "i-lucide-circle-check" });
  } catch (error) {
    showError("Couldn't save the backup", error);
  } finally {
    backingUp.value = false;
  }
}

// Restore: pick a file, check it, then confirm before replacing everything
const fileInput = useTemplateRef("fileInput");
const pendingRestore = shallowRef<Backup>();
const restoreOpen = ref(false);
const restoring = ref(false);

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    pendingRestore.value = parseBackup(await file.text());
    restoreOpen.value = true;
  } catch (error) {
    showError("Couldn't open the backup", error);
  }
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const restoreDescription = computed(() => {
  const backup = pendingRestore.value;
  if (!backup) return "";
  const { accounts, transactions } = backup.data;
  return `Everything on this device will be replaced by the backup from ${formatDate(backup.exportedAt)}, with ${plural(accounts.length, "wallet")} and ${plural(transactions.length, "transaction")}.`;
});

async function restore() {
  if (!pendingRestore.value) return;
  restoring.value = true;
  try {
    await restoreBackup(pendingRestore.value);
    restoreOpen.value = false;
    pendingRestore.value = undefined;
    toast.add({ title: "Backup restored", icon: "i-lucide-circle-check" });
    await navigateTo("/");
  } catch (error) {
    showError("Couldn't restore the backup", error);
  } finally {
    restoring.value = false;
  }
}

// --- Erase: back to a fresh start (onboarding) ---

const eraseOpen = ref(false);
const erasing = ref(false);
async function erase() {
  erasing.value = true;
  try {
    await eraseAllData();
    eraseOpen.value = false;
    await navigateTo("/welcome", { replace: true });
  } catch (error) {
    showError("Couldn't erase the data", error);
  } finally {
    erasing.value = false;
  }
}
</script>

<template>
  <div>
    <PageHeader title="Settings" />

    <div class="px-4">
      <!-- Wallets -->
      <section>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Wallets</h2>
          <UButton label="New wallet" icon="i-lucide-plus" color="neutral" variant="soft" size="lg" class="h-11 px-4" @click="openWallet()" />
        </div>

        <ul class="mt-3 divide-y divide-default overflow-hidden rounded-2xl bg-muted">
          <li v-for="row in walletRows" :key="row.wallet.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
              :aria-label="`Edit ${row.wallet.name}`"
              @click="openWallet(row.wallet)"
            >
              <IconTile icon="i-lucide-wallet" :color="row.wallet.id === activeWallet?.id ? 'primary' : 'info'" size="sm" />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate font-medium text-highlighted">{{ row.wallet.name }}</span>
                  <span
                    v-if="walletRows.length > 1 && row.wallet.id === activeWallet?.id"
                    class="shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-navy-100"
                  >
                    Showing
                  </span>
                </span>
                <span class="mt-0.5 flex items-baseline gap-1.5 text-sm tabular-nums">
                  <span :class="row.balance < 0 ? 'text-error' : 'text-toned'">{{ formatMoney(row.balance, row.wallet.currency) }}</span>
                  <span class="rounded-md bg-elevated px-1.5 text-xs font-medium text-muted">{{ row.wallet.currency }}</span>
                </span>
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
            </button>
          </li>
        </ul>
      </section>

      <!-- Categories -->
      <section class="mt-8">
        <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Categories</h2>
        <UTabs
          :model-value="categoryType"
          :items="categoryTypes"
          :content="false"
          variant="pill"
          aria-label="Category type"
          class="mt-3 w-full"
          @update:model-value="categoryType = $event as Category['type']"
        />

        <div class="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-2">
          <button
            v-for="c in typeCategories"
            :key="c.id"
            type="button"
            :aria-label="`Edit ${c.name}`"
            class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors hover:bg-elevated"
            @click="openCategory(c)"
          >
            <IconTile :icon="c.icon ?? 'i-lucide-tag'" :color="c.color" />
            <span class="w-full truncate text-center text-xs font-medium text-muted">{{ c.name }}</span>
          </button>
          <button
            type="button"
            class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors hover:bg-elevated"
            @click="openCategory()"
          >
            <span class="flex size-12 items-center justify-center rounded-2xl border border-dashed border-accented text-muted">
              <UIcon name="i-lucide-plus" class="size-6" />
            </span>
            <span class="w-full truncate text-center text-xs font-medium text-muted">New</span>
          </button>
        </div>
      </section>

      <!-- Backup: the only copy of the data is on this device -->
      <section class="mt-8">
        <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Backup</h2>
        <div class="mt-3 divide-y divide-default overflow-hidden rounded-2xl bg-muted">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated disabled:opacity-60"
            :disabled="backingUp"
            @click="backUp"
          >
            <IconTile icon="i-lucide-download" color="secondary" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-highlighted">Back up data</span>
              <span class="mt-0.5 block text-sm text-muted tabular-nums">
                {{ lastBackupLabel }}
              </span>
            </span>
            <UIcon v-if="backingUp" name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin text-dimmed" />
            <UIcon v-else name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
            @click="fileInput?.click()"
          >
            <IconTile icon="i-lucide-upload" color="info" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-highlighted">Restore from backup</span>
              <span class="mt-0.5 block text-sm text-muted">Replaces everything on this device</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
          </button>
        </div>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onFilePicked" />
      </section>

      <!-- Erase -->
      <section class="mt-8">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left transition-colors hover:bg-elevated"
          @click="eraseOpen = true"
        >
          <IconTile icon="i-lucide-trash-2" color="error" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-error">Erase all data</span>
            <span class="mt-0.5 block text-sm text-muted">Start over with no wallets</span>
          </span>
        </button>
      </section>
    </div>

    <WalletModal v-model:open="walletModalOpen" :wallet="editingWallet" :can-delete="walletRows.length > 1" />
    <CategoryEditModal v-model:open="categoryModalOpen" :category="editingCategory" :type="categoryType" />
    <ConfirmModal
      v-model:open="restoreOpen"
      title="Restore this backup?"
      :description="restoreDescription"
      confirm-label="Restore"
      :loading="restoring"
      @confirm="restore"
    />
    <ConfirmModal
      v-model:open="eraseOpen"
      title="Erase all data?"
      description="All wallets, transactions, goals and budgets on this device will be deleted. Back up first if you might need them."
      confirm-label="Erase"
      :loading="erasing"
      @confirm="erase"
    />
  </div>
</template>

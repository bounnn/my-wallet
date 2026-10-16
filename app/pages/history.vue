<script setup lang="ts">
// Every income, expense and transfer of the shown wallet, all months, newest first.
// Opened from home's History button; a filter narrows it to one kind.
definePageMeta({ layout: false });
useHead({ title: "History" });

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: transfers } = useLiveQuery(() => db.transfers.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

const { wallet } = useActiveWallet(wallets);
const currency = computed(() => wallet.value?.currency ?? "USD");
const walletById = computed(() => new Map((wallets.value ?? []).map((w) => [w.id, w])));
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

// What an item does to the shown wallet's balance
const signed = (t: Transaction | Transfer) =>
  isTransfer(t) ? transferChange(t, wallet.value?.id) : t.type === "income" ? t.amount : -t.amount;

// --- Filter: kept while opening an item to edit and coming back ---
type Filter = "all" | Transaction["type"] | "transfer";
const filter = useState<Filter>("history-filter", () => "all");
const filters = computed(() => [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Expenses", value: "expense" },
  // Only once there's a second wallet or a transfer already
  ...((wallets.value?.length ?? 0) > 1 || transfers.value?.length ? [{ label: "Transfers", value: "transfer" }] : []),
]);

const items = computed(() => {
  const id = wallet.value?.id;
  const own = (transactions.value ?? []).filter(
    (t) => t.accountId === id && (filter.value === "all" || filter.value === t.type),
  );
  const moved =
    filter.value === "all" || filter.value === "transfer"
      ? (transfers.value ?? []).filter((t) => t.fromAccountId === id || t.toAccountId === id)
      : [];
  return [...own, ...moved].sort((a, b) => b.date.getTime() - a.date.getTime());
});

// --- Month groups (from the start day set in Settings), each split into days ---
const { startDay } = useMonthStart();
const monthName = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const months = computed(() => {
  const groups = new Map<string, (Transaction | Transfer)[]>();
  for (const t of items.value) {
    const { year, month } = monthOf(t.date, startDay.value);
    const key = monthKey(new Date(year, month - 1, 1));
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const newest = list[0]!.date;
    const oldest = list.at(-1)!.date;
    const [year, month] = key.split("-").map(Number);
    return {
      key,
      label: monthName.format(new Date(year!, month! - 1, 1)),
      range: `${formatDayMonth(oldest)} – ${formatDayMonth(newest)}`,
      days: groupByDay(list, signed),
    };
  });
});

// Months open and close on their own; the newest starts open (undefined = not touched yet)
const openMonths = ref<Set<string>>();
const isMonthOpen = (key: string) => (openMonths.value ? openMonths.value.has(key) : months.value[0]?.key === key);
function setMonthOpen(key: string, open: boolean) {
  const next = new Set(openMonths.value ?? (months.value[0] ? [months.value[0].key] : []));
  if (open) next.add(key);
  else next.delete(key);
  openMonths.value = next;
}
watch([filter, () => wallet.value?.id], () => (openMonths.value = undefined));

// Empty: what's missing, a line on where it comes from, and a button to add the first one
const empty = computed(
  () =>
    ({
      all: {
        title: "No history yet",
        text: "Income, expenses and transfers of this wallet show up here.",
        action: "Add income",
        to: "/add?type=income",
      },
      income: {
        title: "No income yet",
        text: "Money coming into this wallet shows up here.",
        action: "Add income",
        to: "/add?type=income",
      },
      expense: {
        title: "No expenses yet",
        text: "Money going out of this wallet shows up here.",
        action: "Add an expense",
        to: "/add?type=expense",
      },
      transfer: {
        title: "No transfers yet",
        text: "Money moved between your wallets shows up here.",
        action: "Make a transfer",
        to: "/add?type=transfer",
      },
    })[filter.value],
);

// --- Details: tapping an item opens it (edit / delete) ---
const selected = shallowRef<Transaction>();
const detailsOpen = ref(false);
const selectedTransfer = shallowRef<Transfer>();
const transferOpen = ref(false);
function showDetails(t: Transaction | Transfer) {
  if (isTransfer(t)) {
    selectedTransfer.value = t;
    transferOpen.value = true;
  } else {
    selected.value = t;
    detailsOpen.value = true;
  }
}

// Go back when opened from inside the app, otherwise home (e.g. after a reload)
function close() {
  if (window.history.state?.back) useRouter().back();
  else navigateTo("/", { replace: true });
}
</script>

<template>
  <div class="pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
    <!-- Top bar like the add screen: back + title, the wallet picker on the right (with 2+ wallets) -->
    <header class="flex h-14 items-center gap-2 px-4">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        class="-ml-2"
        @click="close"
      />
      <h1 class="flex-1 truncate font-display text-lg font-semibold tracking-tight text-highlighted">History</h1>
      <WalletPicker />
    </header>

    <div class="px-4">
      <UTabs
        :model-value="filter"
        :items="filters"
        :content="false"
        variant="pill"
        size="sm"
        aria-label="Show"
        :ui="{ trigger: 'h-9' }"
        @update:model-value="filter = $event as Filter"
      />

      <!-- Empty: faded placeholder rows (like home's) hint at the list to come, then what's missing and a way to
           add the first one -->
      <div v-if="!months.length" class="mt-3 overflow-hidden rounded-2xl bg-muted">
        <ul aria-hidden="true" class="divide-y divide-default mask-[linear-gradient(to_bottom,black,transparent)]">
          <li v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-3">
            <span class="size-10 shrink-0 rounded-2xl bg-elevated" />
            <span class="flex-1 space-y-2">
              <span class="block h-2.5 rounded-full bg-elevated" :class="['w-24', 'w-32', 'w-20'][i - 1]" />
              <span class="block h-2 w-16 rounded-full bg-elevated/60" />
            </span>
            <span class="h-2.5 w-14 rounded-full bg-elevated" />
          </li>
        </ul>
        <div class="flex flex-col items-center px-6 pb-6 text-center">
          <p class="font-display font-semibold text-highlighted">{{ empty.title }}</p>
          <p class="mt-1 text-sm text-muted">{{ empty.text }}</p>
          <UButton
            :to="empty.to"
            :label="empty.action"
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            class="mt-4 h-11 justify-center bg-elevated px-5"
          />
        </div>
      </div>

      <!-- Months joined in one card, each collapsible -->
      <div v-else class="surface-card mt-3 divide-y divide-default rounded-2xl">
        <TransactionGroup
          v-for="month in months"
          :key="month.key"
          :open="isMonthOpen(month.key)"
          :label="month.label"
          :sublabel="month.range"
          :days="month.days"
          :currency="currency"
          hide-currency
          :category-by-id="categoryById"
          :wallet-by-id="walletById"
          :wallet-id="wallet?.id"
          @update:open="setMonthOpen(month.key, $event)"
          @select="showDetails"
        />
      </div>
    </div>

    <TransactionModal
      v-model:open="detailsOpen"
      :transaction="selected"
      :category="selected && categoryById.get(selected.categoryId)"
      :wallet="selected && walletById.get(selected.accountId)"
      :show-wallet="(wallets?.length ?? 0) > 1"
    />
    <TransferModal v-model:open="transferOpen" :transfer="selectedTransfer" :wallet-by-id="walletById" />
  </div>
</template>

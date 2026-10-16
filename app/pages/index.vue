<script setup lang="ts">
import type { CalendarDate } from "@internationalized/date";

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(
  () => db.transactions.toArray(),
  [],
);
const { value: transfers } = useLiveQuery(() => db.transfers.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// Home shows one wallet at a time (picked in the header), in its own currency
const { wallet, pick } = useActiveWallet(wallets);
// Tapping the card (with 2+ wallets) lists them to switch
const walletListOpen = ref(false);
const currency = computed(() => wallet.value?.currency ?? "USD");
const walletById = computed(
  () => new Map((wallets.value ?? []).map((w) => [w.id, w])),
);
const categoryById = computed(
  () => new Map((categories.value ?? []).map((c) => [c.id, c])),
);

// What an item does to the shown wallet's balance
const signed = (t: Transaction | Transfer) =>
  isTransfer(t)
    ? transferChange(t, wallet.value?.id)
    : t.type === "income"
      ? t.amount
      : -t.amount;

const walletTransactions = computed(() =>
  (transactions.value ?? []).filter((t) => t.accountId === wallet.value?.id),
);
// Transfers out of and into the wallet; they move the balance but aren't income or expenses
const walletTransfers = computed(() =>
  (transfers.value ?? []).filter(
    (t) =>
      t.fromAccountId === wallet.value?.id || t.toAccountId === wallet.value?.id,
  ),
);

const balance = computed(
  () =>
    (wallet.value?.initialBalance ?? 0) +
    [...walletTransactions.value, ...walletTransfers.value].reduce(
      (s, t) => s + signed(t),
      0,
    ),
);

// Actions under the card: transfer only with another wallet to send to
const canTransfer = computed(() => (wallets.value?.length ?? 0) > 1);
const cardActions = computed(() => [
  { to: "/add?type=income", label: "Income", icon: "i-lucide-arrow-down" },
  { to: "/add?type=expense", label: "Expense", icon: "i-lucide-arrow-up" },
  ...(canTransfer.value
    ? [
        {
          to: "/add?type=transfer",
          label: "Transfer",
          icon: "i-lucide-arrow-left-right",
        },
      ]
    : []),
  // Every income, expense and transfer of the wallet, all months
  { to: "/history", label: "History", icon: "i-lucide-history" },
]);

// Picked month (MonthPicker in the top bar) filters the whole screen. Months may start on another day than
// the 1st (Settings).
const { currentMonth, rangeOf } = useMonthStart();
const thisMonth = currentMonth();
const pickedMonth = shallowRef<CalendarDate>(thisMonth);

const month = computed(
  () => new Date(pickedMonth.value.year, pickedMonth.value.month - 1, 1),
);

// The picked month's items, newest first
function inMonth<T extends Transaction | Transfer>(list: T[]) {
  const { from, to } = rangeOf(pickedMonth.value);
  return list
    .filter((t) => t.date >= from && t.date < to)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
const monthTransactions = computed(() => inMonth(walletTransactions.value));
// The date list also shows transfers
const monthItems = computed(() =>
  inMonth([...walletTransactions.value, ...walletTransfers.value]),
);

const income = computed(() =>
  monthTransactions.value
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0),
);
const expenses = computed(() =>
  monthTransactions.value
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0),
);

// Transactions list: grouped by week (date), by category, or a calendar with each day's totals
type View = "date" | "category" | "calendar";
const views = [
  { label: "Date", value: "date" },
  { label: "Category", value: "category" },
  { label: "Calendar", value: "calendar" },
];
// useState keeps the choice while visiting /add and coming back
const view = useState<View>("home-transactions-view", () => "date");
const monthBounds = computed(() => rangeOf(pickedMonth.value));

// Week groups (Monday → Sunday), newest first, each split into days
const weeks = computed(() => {
  const thisWeek = startOfWeek(new Date()).getTime();
  const lastWeek = thisWeek - 7 * 24 * 60 * 60 * 1000;
  const groups = new Map<number, (Transaction | Transfer)[]>();
  for (const t of monthItems.value) {
    const key = startOfWeek(t.date).getTime();
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const start = new Date(key);
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
    );
    return {
      key,
      label:
        key === thisWeek
          ? "This week"
          : key === lastWeek
            ? "Last week"
            : `Week of ${formatDayMonth(start)}`,
      range: `${formatDayMonth(start)} – ${formatDayMonth(end)}`,
      days: groupByDay(items, signed),
    };
  });
});

// Weeks open and close on their own, so two can be compared; the newest starts open
// (undefined = not touched yet this month)
const openWeeks = ref<Set<number>>();
const isWeekOpen = (key: number) =>
  openWeeks.value ? openWeeks.value.has(key) : weeks.value[0]?.key === key;
function setWeekOpen(key: number, open: boolean) {
  const next = new Set(
    openWeeks.value ?? (weeks.value[0] ? [weeks.value[0].key] : []),
  );
  if (open) next.add(key);
  else next.delete(key);
  openWeeks.value = next;
}
watch(
  [pickedMonth, () => wallet.value?.id],
  () => (openWeeks.value = undefined),
);

// Empty month: point to the + button for this month, just say so for past ones
const monthName = new Intl.DateTimeFormat(undefined, { month: "long" });
const emptyText = computed(() =>
  pickedMonth.value.compare(thisMonth) === 0
    ? "Nothing yet. Tap + to add one"
    : `Nothing in ${monthName.format(month.value)}`,
);

// Backup reminder under the card once there's something to lose: never backed up, or over a month ago.
// "Later" hides it for a week.
const {
  backUp,
  saving: backingUp,
  isStale,
  isSnoozed,
  snooze,
  lastBackup,
} = useBackup();
const showBackupReminder = computed(
  () => !!transactions.value?.length && isStale.value && !isSnoozed.value,
);

// Categories split into Expenses and Income sections (a goal's category can be in both), biggest first
function groupByCategory(type: Transaction["type"], typeTotal: number) {
  const groups = new Map<
    number,
    { key: string; category?: Category; total: number; items: Transaction[] }
  >();
  for (const t of monthTransactions.value) {
    if (t.type !== type) continue;
    const group = groups.get(t.categoryId) ?? {
      key: `${type}-${t.categoryId}`,
      category: categoryById.value.get(t.categoryId),
      total: 0,
      items: [],
    };
    group.total += t.amount;
    group.items.push(t);
    groups.set(t.categoryId, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, share: typeTotal ? g.total / typeTotal : 0 }))
    .sort((a, b) => b.total - a.total);
}
const categorySections = computed(() =>
  [
    { type: "expense" as const, title: "Expenses", total: expenses.value },
    { type: "income" as const, title: "Income", total: income.value },
  ]
    .map((s) => ({ ...s, groups: groupByCategory(s.type, s.total) }))
    .filter((s) => s.groups.length),
);

// One category open at a time, all closed to start so the list reads as a summary
const openCategory = ref<string | null>(null);
watch([pickedMonth, () => wallet.value?.id], () => (openCategory.value = null));

// Tapping a transaction or transfer opens its details (edit / delete). Kept as the tapped copy so the
// modal still has it while closing after a delete.
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
</script>

<template>
  <div>
    <!-- Same header as the other tabs (no title), so the month picker sits where it does on Report.
         The month picker and the wallet (switched by tapping the card) filter the whole screen. -->
    <PageHeader>
      <template #trailing>
        <MonthPicker v-model="pickedMonth" />
      </template>
    </PageHeader>

    <div class="px-4">
      <!-- Hero: total balance + this month's income and expenses -->
      <WalletCard
        :name="wallet?.name ?? ''"
        :currency="currency"
        :balance="balance"
        label="Balance"
        tilt
        :switchable="(wallets?.length ?? 0) > 1"
        @switch="walletListOpen = true"
      >
        <div class="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/12"
            >
              <UIcon
                name="i-lucide-arrow-down-left"
                class="size-4 text-emerald-300"
              />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-white/70">Income</p>
              <p
                class="truncate font-display text-sm font-semibold tabular-nums"
              >
                {{ formatAmount(income, currency) }}
              </p>
            </div>
          </div>
          <div class="flex min-w-0 items-center gap-2.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/12"
            >
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-4 text-rose-300"
              />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-white/70">Expenses</p>
              <p
                class="truncate font-display text-sm font-semibold tabular-nums"
              >
                {{ formatAmount(expenses, currency) }}
              </p>
            </div>
          </div>
        </div>
      </WalletCard>

      <!-- Quick actions under the card, wallet-app style: a plain icon tile with its name under it. Each
           opens the add screen on that type (Transfer needs a second wallet); History lists them all. -->
      <div class="mt-5 flex justify-center gap-5">
        <NuxtLink
          v-for="action in cardActions"
          :key="action.to"
          :to="action.to"
          class="group flex w-16 flex-col items-center gap-2"
        >
          <span
            class="flex size-13 items-center justify-center rounded-2xl bg-muted text-highlighted transition-[transform,background-color] group-active:scale-95 group-active:bg-elevated motion-reduce:group-active:scale-100"
          >
            <UIcon :name="action.icon" class="size-5" />
          </span>
          <span class="text-xs font-medium text-toned">{{ action.label }}</span>
        </NuxtLink>
      </div>

      <!-- The app's promise, scrolling edge to edge under the hero -->
      <MarqueeBanner
        text="Works offline - Your data never leaves this device"
        class="-mx-4 mt-8 w-auto"
      />

      <!-- Backup reminder: the data only lives here, so a missing or old backup gets one quiet card -->
      <div v-if="showBackupReminder" class="surface-card mt-8 rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <IconTile icon="i-lucide-shield-alert" color="warning" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted">
              {{ lastBackup ? "Time for a new backup" : "Back up your data" }}
            </p>
            <p class="mt-0.5 text-sm text-muted">
              It only lives on this phone.
            </p>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Later"
            color="neutral"
            variant="ghost"
            class="h-11 flex-1 justify-center"
            @click="snooze"
          />
          <UButton
            label="Back up"
            icon="i-lucide-download"
            color="neutral"
            variant="soft"
            class="h-11 flex-1 justify-center bg-elevated"
            :loading="backingUp"
            @click="backUp"
          />
        </div>
      </div>

      <!-- Transactions: by date (weeks), by category, or as a calendar -->
      <section class="mt-8">
        <div class="flex items-center justify-between gap-3">
          <h2
            class="font-display text-lg font-semibold tracking-tight text-highlighted"
          >
            Transactions
          </h2>
          <UTabs
            v-if="weeks.length"
            :model-value="view"
            :items="views"
            :content="false"
            variant="pill"
            size="xs"
            aria-label="Group transactions"
            class="w-52 shrink-0"
            @update:model-value="view = $event as View"
          />
        </div>

        <!-- Empty: faded placeholder rows hint at the list to come, one short line on top -->
        <div
          v-if="!weeks.length"
          class="relative mt-3 overflow-hidden rounded-2xl bg-muted"
        >
          <ul
            aria-hidden="true"
            class="divide-y divide-default mask-[linear-gradient(to_bottom,black,transparent)]"
          >
            <li
              v-for="i in 3"
              :key="i"
              class="flex items-center gap-3 px-4 py-3"
            >
              <span class="size-10 shrink-0 rounded-2xl bg-elevated" />
              <span class="flex-1 space-y-2">
                <span
                  class="block h-2.5 rounded-full bg-elevated"
                  :class="['w-24', 'w-32', 'w-20'][i - 1]"
                />
                <span class="block h-2 w-16 rounded-full bg-elevated/60" />
              </span>
              <span class="h-2.5 w-14 rounded-full bg-elevated" />
            </li>
          </ul>
          <p
            class="absolute inset-x-0 bottom-5 text-center text-sm font-medium text-muted"
          >
            {{ emptyText }}
          </p>
        </div>

        <!-- Weeks (Monday first) joined in one card, each collapsible -->
        <div
          v-if="weeks.length && view === 'date'"
          class="surface-card mt-3 divide-y divide-default rounded-2xl"
        >
          <TransactionGroup
            v-for="week in weeks"
            :key="week.key"
            :open="isWeekOpen(week.key)"
            :label="week.label"
            :sublabel="week.range"
            :days="week.days"
            :currency="currency"
            hide-currency
            :category-by-id="categoryById"
            :wallet-by-id="walletById"
            :wallet-id="wallet?.id"
            @update:open="setWeekOpen(week.key, $event)"
            @select="showDetails"
          />
        </div>

        <!-- Categories: Expenses then Income, one card per category, biggest first -->
        <!-- Calendar: each day's income and expenses, then the tapped day's list -->
        <TransactionCalendar
          v-if="weeks.length && view === 'calendar'"
          :from="monthBounds.from"
          :to="monthBounds.to"
          :items="monthItems"
          :currency="currency"
          :wallet-id="wallet?.id"
          :category-by-id="categoryById"
          :wallet-by-id="walletById"
          class="mt-3"
          @select="showDetails"
        />

        <div v-if="weeks.length && view === 'category'" class="mt-3 space-y-6">
          <!-- Transfers have no category, so a month of only transfers has nothing here -->
          <p
            v-if="!categorySections.length"
            class="rounded-2xl bg-muted px-4 py-6 text-center text-sm font-medium text-muted"
          >
            Only transfers this month
          </p>
          <div v-for="section in categorySections" :key="section.type">
            <div class="flex items-baseline justify-between gap-3 px-1">
              <h3 class="text-sm font-semibold text-toned">
                {{ section.title }}
              </h3>
              <p
                class="font-display text-sm font-semibold tabular-nums"
                :class="
                  section.type === 'income'
                    ? 'text-success'
                    : 'text-highlighted'
                "
              >
                {{ formatAmount(section.total, currency) }}
              </p>
            </div>
            <div class="mt-2 space-y-3">
              <CategoryGroup
                v-for="group in section.groups"
                :key="group.key"
                :open="openCategory === group.key"
                :category="group.category"
                :type="section.type"
                :total="group.total"
                :share="group.share"
                :items="group.items"
                :currency="currency"
                @update:open="openCategory = $event ? group.key : null"
                @select="showDetails"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <TransactionModal
      v-model:open="detailsOpen"
      :transaction="selected"
      :category="selected && categoryById.get(selected.categoryId)"
      :wallet="selected && walletById.get(selected.accountId)"
      :show-wallet="(wallets?.length ?? 0) > 1"
    />
    <WalletSelectModal
      v-model:open="walletListOpen"
      :wallets="wallets ?? []"
      :selected-id="wallet?.id"
      manage
      @select="pick"
    />
    <TransferModal
      v-model:open="transferOpen"
      :transfer="selectedTransfer"
      :wallet-by-id="walletById"
    />
  </div>
</template>

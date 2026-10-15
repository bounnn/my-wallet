<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// Wallets can use different currencies, so totals use the first wallet's currency
const currency = computed(() => wallets.value?.[0]?.currency ?? "USD");
const walletById = computed(() => new Map((wallets.value ?? []).map((w) => [w.id, w])));
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

// One wallet shows its own name; several are summed into one total card
const cardName = computed(() =>
  wallets.value?.length === 1 ? wallets.value[0]!.name : "All wallets",
);

const signed = (t: Transaction) => (t.type === "income" ? t.amount : -t.amount);

const balance = computed(() =>
  (wallets.value ?? [])
    .filter((w) => w.currency === currency.value)
    .reduce(
      (sum, w) =>
        sum +
        w.initialBalance +
        (transactions.value ?? []).filter((t) => t.accountId === w.id).reduce((s, t) => s + signed(t), 0),
      0,
    ),
);

// Picked month (MonthPicker in the top bar) filters the whole screen
const now = new Date();
const thisMonth = new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1);
const pickedMonth = shallowRef<CalendarDate>(thisMonth);

const month = computed(() => new Date(pickedMonth.value.year, pickedMonth.value.month - 1, 1));

const monthTransactions = computed(() => {
  const from = month.value;
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return (transactions.value ?? [])
    .filter((t) => walletById.value.get(t.accountId)?.currency === currency.value)
    .filter((t) => t.date >= from && t.date < to)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
});

const income = computed(() =>
  monthTransactions.value.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
);
const expenses = computed(() =>
  monthTransactions.value.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
);

// Category slides: the month's total per category, biggest first
const categoryTotals = computed(() => {
  const totals = new Map<number, { category?: Category; type: Transaction["type"]; total: number; count: number }>();
  for (const t of monthTransactions.value) {
    const entry = totals.get(t.categoryId) ?? {
      category: categoryById.value.get(t.categoryId),
      type: t.type,
      total: 0,
      count: 0,
    };
    entry.total += t.amount;
    entry.count++;
    totals.set(t.categoryId, entry);
  }
  return [...totals.entries()].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.total - a.total);
});

// Splits newest-first transactions into days ("Today", "Yesterday", "Wed 14/10")
function groupByDay(list: Transaction[]) {
  const days: TransactionDay[] = [];
  for (const t of list) {
    const key = t.date.toDateString();
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, date: t.date, label: weekdayLabel(t.date), total: 0, items: [] };
      days.push(day);
    }
    day.total += signed(t);
    day.items.push(t);
  }
  return days;
}

// Recent (Today + Yesterday) pinned on top while viewing this month; these stay in their week below too.
// Not limited to the picked month, so yesterday still shows on the 1st.
const recentDays = computed(() => {
  if (pickedMonth.value.compare(thisMonth) !== 0) return [];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return groupByDay(
    (transactions.value ?? [])
      .filter((t) => walletById.value.get(t.accountId)?.currency === currency.value)
      .filter((t) => t.date >= from && t.date < to)
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
  );
});
const recentOpen = ref(true);

// Week groups (Monday → Sunday), newest first, each split into days
const weeks = computed(() => {
  const thisWeek = startOfWeek(new Date()).getTime();
  const lastWeek = thisWeek - 7 * 24 * 60 * 60 * 1000;
  const groups = new Map<number, Transaction[]>();
  for (const t of monthTransactions.value) {
    const key = startOfWeek(t.date).getTime();
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const start = new Date(key);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return {
      key,
      label: key === thisWeek ? "This week" : key === lastWeek ? "Last week" : `Week of ${formatDayMonth(start)}`,
      range: `${formatDayMonth(start)} – ${formatDayMonth(end)}`,
      days: groupByDay(items),
    };
  });
});

// One week open at a time: opening a week closes the others. Starts on the newest week
// (undefined = not picked yet), null = all closed
const openWeek = ref<number | null>();
const isWeekOpen = (key: number) => (openWeek.value === undefined ? weeks.value[0]?.key : openWeek.value) === key;
watch(pickedMonth, () => (openWeek.value = undefined));
</script>

<template>
  <div class="px-5 pt-[max(env(safe-area-inset-top),0.75rem)]">
    <!-- Top bar: logo + month picker (filters the whole screen) -->
    <header class="flex h-12 items-center justify-between">
      <img src="/logo.svg" alt="My Wallet" class="size-9 rounded-full" />
      <MonthPicker v-model="pickedMonth" />
    </header>

    <!-- Hero: total balance + this month's income and expenses -->
    <WalletCard :name="cardName" :currency="currency" :balance="balance" label="Total balance" class="mt-4">
      <div class="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/12">
            <UIcon name="i-lucide-arrow-down-left" class="size-4 text-emerald-300" />
          </span>
          <div class="min-w-0">
            <p class="text-xs text-white/70">Income</p>
            <p class="truncate font-display text-sm font-semibold tabular-nums">
              {{ formatAmount(income, currency) }}
            </p>
          </div>
        </div>
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/12">
            <UIcon name="i-lucide-arrow-up-right" class="size-4 text-rose-300" />
          </span>
          <div class="min-w-0">
            <p class="text-xs text-white/70">Expenses</p>
            <p class="truncate font-display text-sm font-semibold tabular-nums">
              {{ formatAmount(expenses, currency) }}
            </p>
          </div>
        </div>
      </div>
    </WalletCard>

    <!-- Categories: month total per category, swipe sideways -->
    <section v-if="categoryTotals.length" class="mt-8">
      <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Categories</h2>
      <!-- Separate cards that scroll sideways and bleed to the screen edges -->
      <ul
        class="-mx-5 mt-1 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pt-2 pb-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <li
          v-for="c in categoryTotals"
          :key="c.id"
          class="surface-card flex w-[75%] shrink-0 snap-start flex-col rounded-2xl px-5 py-4"
        >
          <div class="flex items-center gap-2">
            <IconTile :icon="c.category?.icon ?? 'i-lucide-tag'" :color="c.category?.color" size="xs" />
            <p class="min-w-0 truncate text-sm font-medium text-muted">{{ c.category?.name ?? "Uncategorized" }}</p>
          </div>
          <MoneyAmount
            :amount="c.total"
            :currency="currency"
            hide-currency
            class="mt-5"
            :amount-class="['text-2xl font-bold tracking-tight', c.type === 'income' ? 'text-success' : 'text-highlighted'].join(' ')"
          />
          <p class="mt-1 text-xs text-dimmed">
            {{ c.count }} {{ c.count === 1 ? "transaction" : "transactions" }}
          </p>
        </li>
      </ul>
    </section>

    <!-- Transactions -->
    <section :class="categoryTotals.length ? 'mt-1' : 'mt-8'">
      <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Transactions</h2>

      <!-- Empty: faded placeholder rows hint at the list to come, one short line on top -->
      <div v-if="!weeks.length" class="relative mt-3 overflow-hidden rounded-2xl bg-muted">
        <ul
          aria-hidden="true"
          class="divide-y divide-default [mask-image:linear-gradient(to_bottom,black,transparent)]"
        >
          <li v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-3">
            <span class="size-10 shrink-0 rounded-2xl bg-elevated" />
            <span class="flex-1 space-y-2">
              <span class="block h-2.5 rounded-full bg-elevated" :class="['w-24', 'w-32', 'w-20'][i - 1]" />
              <span class="block h-2 w-16 rounded-full bg-elevated/60" />
            </span>
            <span class="h-2.5 w-14 rounded-full bg-elevated" />
          </li>
        </ul>
        <p class="absolute inset-x-0 bottom-5 text-center text-sm font-medium text-muted">No transactions yet</p>
      </div>

      <!-- Recent: Today + Yesterday, pinned on top -->
      <div v-if="recentDays.length" class="surface-card mt-3 rounded-2xl">
        <TransactionGroup
          v-model:open="recentOpen"
          label="Recent"
          sublabel="Today & yesterday"
          :days="recentDays"
          :currency="currency"
          hide-currency
          :category-by-id="categoryById"
          :wallet-by-id="walletById"
        />
      </div>

      <!-- Weeks (Monday first) joined in one card, each collapsible; recent days are counted here too -->
      <div v-if="weeks.length" class="surface-card mt-4 divide-y divide-default rounded-2xl">
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
          @update:open="openWeek = $event ? week.key : null"
        />
      </div>
    </section>
  </div>
</template>

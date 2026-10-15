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

// Transactions list: grouped by week (date) or by category
const views = [
  { label: "By date", value: "date" },
  { label: "By category", value: "category" },
];
// useState keeps the choice while visiting /add and coming back
const view = useState<"date" | "category">("home-transactions-view", () => "date");

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

// Categories split into Expenses and Income sections (a goal's category can be in both), biggest first
function groupByCategory(type: Transaction["type"], typeTotal: number) {
  const groups = new Map<number, { key: string; category?: Category; total: number; items: Transaction[] }>();
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
watch(pickedMonth, () => (openCategory.value = null));
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

    <!-- Transactions: by date (weeks) or by category -->
    <section class="mt-8">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Transactions</h2>
        <UTabs
          v-if="weeks.length"
          :model-value="view"
          :items="views"
          :content="false"
          variant="pill"
          size="xs"
          aria-label="Group transactions"
          class="w-48 shrink-0"
          @update:model-value="view = $event as 'date' | 'category'"
        />
      </div>

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

      <!-- Weeks (Monday first) joined in one card, each collapsible -->
      <div v-if="weeks.length && view === 'date'" class="surface-card mt-3 divide-y divide-default rounded-2xl">
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

      <!-- Categories: Expenses then Income, one card per category, biggest first -->
      <template v-if="weeks.length && view === 'category'">
        <div v-for="section in categorySections" :key="section.type" class="mt-4 first:mt-3">
          <div class="flex items-baseline justify-between gap-3 px-1">
            <h3 class="text-sm font-semibold text-toned">{{ section.title }}</h3>
            <p
              class="font-display text-sm font-semibold tabular-nums"
              :class="section.type === 'income' ? 'text-success' : 'text-highlighted'"
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
            />
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

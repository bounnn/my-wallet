<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";

useHead({ title: "Report" });

// Report (ui/ref1, middle screen): the picked wallet's expenses or income for the month by category as a donut,
// or the last 6 months as bars, with a per-category list compared to last month
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// One wallet at a time, in its own currency (same picker as home and plan)
const { wallet } = useActiveWallet(wallets);
const currency = computed(() => wallet.value?.currency ?? "USD");
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

const now = new Date();
const pickedMonth = shallowRef(new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1));
const month = computed(() => new Date(pickedMonth.value.year, pickedMonth.value.month - 1, 1));

const type = ref<Transaction["type"]>("expense");
const types = [
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
];
const view = ref<"donut" | "bars">("donut");
const typeName = computed(() => (type.value === "expense" ? "Expenses" : "Income"));

// The picked type's transactions in [from, to), from the picked wallet
function inRange(from: Date, to: Date) {
  return (transactions.value ?? []).filter(
    (t) =>
      t.type === type.value &&
      t.accountId === wallet.value?.id &&
      t.date >= from &&
      t.date < to,
  );
}

const monthTransactions = computed(() =>
  inRange(month.value, new Date(month.value.getFullYear(), month.value.getMonth() + 1, 1)),
);
const lastMonthTransactions = computed(() =>
  inRange(new Date(month.value.getFullYear(), month.value.getMonth() - 1, 1), month.value),
);

const total = computed(() => monthTransactions.value.reduce((s, t) => s + t.amount, 0));

// Per category, biggest first, with last month's total for the change chip
const byCategory = computed(() => {
  const sums = (list: Transaction[]) => {
    const map = new Map<number, number>();
    for (const t of list) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    return map;
  };
  const last = sums(lastMonthTransactions.value);
  return [...sums(monthTransactions.value).entries()]
    .map(([id, sum]) => {
      const category = categoryById.value.get(id);
      return {
        id,
        name: category?.name ?? "Uncategorized",
        icon: category?.icon ?? "i-lucide-tag",
        color: category?.color ?? DEFAULT_CATEGORY_COLOR,
        total: sum,
        share: total.value ? sum / total.value : 0,
        last: last.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);
});

const segments = computed(() =>
  byCategory.value.map((c) => ({
    id: c.id,
    label: c.name,
    value: c.total,
    color: c.color,
    valueLabel: `${formatAmount(c.total, currency.value)} ${currency.value}, ${percent(c.share)}`,
  })),
);

// Trend view: the picked month and the 5 before it, oldest first
const shortMonth = new Intl.DateTimeFormat(undefined, { month: "short" });
const longMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const monthTotals = computed(() =>
  Array.from({ length: 6 }, (_, i) => {
    const from = new Date(month.value.getFullYear(), month.value.getMonth() - 5 + i, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return {
      key: from.toISOString(),
      label: shortMonth.format(from),
      title: longMonth.format(from),
      total: inRange(from, to).reduce((s, t) => s + t.amount, 0),
    };
  }),
);

const selectedCategory = ref<number | null>(null);
const selectedMonth = ref<number | null>(null);
const selected = computed(() => byCategory.value.find((c) => c.id === selectedCategory.value));
watch([pickedMonth, type], () => {
  selectedCategory.value = null;
  selectedMonth.value = null;
});

const percent = (share: number) => `${Math.round(share * 100)}%`;

// Change vs last month; for expenses going up is bad (rose), for income it's good (emerald).
// Only called when last month had some, otherwise there's no percentage to show.
function change(c: { total: number; last: number }) {
  const diff = (c.total - c.last) / c.last;
  const rounded = Math.round(diff * 100);
  if (rounded === 0) return { label: "0%", icon: "i-lucide-equal", class: "bg-elevated text-muted" };
  const good = (rounded > 0) === (type.value === "income");
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
    icon: rounded > 0 ? "i-lucide-trending-up" : "i-lucide-trending-down",
    class: good ? "bg-success/15 text-success" : "bg-error/15 text-error",
  };
}
</script>

<template>
  <div>
    <!-- With several wallets the wallet picker takes the title's place, like home: the month pill is too long
         to fit a title and two pills on a phone -->
    <PageHeader :title="(wallets?.length ?? 0) > 1 ? undefined : 'Report'">
      <template #leading>
        <WalletPicker />
      </template>
      <template #trailing>
        <MonthPicker v-model="pickedMonth" />
      </template>
    </PageHeader>

    <div class="px-4">
      <UTabs
        :model-value="type"
        :items="types"
        :content="false"
        variant="pill"
        aria-label="Report type"
        class="w-full"
        @update:model-value="type = $event as Transaction['type']"
      />

      <!-- Chart card: donut by category or a 6-month trend -->
      <section class="surface-card mt-4 rounded-2xl p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">{{ typeName }} report</h2>
          <div class="flex gap-1 rounded-full bg-elevated p-1" role="group" aria-label="Chart type">
            <button
              v-for="v in [
                { value: 'bars', icon: 'i-lucide-chart-column', label: 'Last 6 months' },
                { value: 'donut', icon: 'i-lucide-chart-pie', label: 'By category' },
              ] as const"
              :key="v.value"
              type="button"
              :aria-label="v.label"
              :aria-pressed="view === v.value"
              class="flex size-10 items-center justify-center rounded-full transition-colors"
              :class="view === v.value ? 'bg-primary/20 text-navy-100' : 'text-muted hover:text-toned'"
              @click="view = v.value"
            >
              <UIcon :name="v.icon" class="size-4" />
            </button>
          </div>
        </div>

        <DonutChart
          v-if="view === 'donut'"
          v-model:selected="selectedCategory"
          :segments="segments"
          :label="`${typeName} by category`"
          class="mt-4"
        >
          <template v-if="selected">
            <p class="max-w-full truncate text-sm text-muted">{{ selected.name }}</p>
            <p class="max-w-full truncate font-display text-2xl font-bold tracking-tight text-highlighted tabular-nums">
              {{ formatAmount(selected.total, currency) }}
            </p>
            <span class="mt-1 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned tabular-nums">
              {{ percent(selected.share) }} of total
            </span>
          </template>
          <template v-else>
            <p class="text-sm text-muted">Total {{ typeName.toLowerCase() }}</p>
            <p class="max-w-full truncate font-display text-2xl font-bold tracking-tight text-highlighted tabular-nums">
              {{ formatAmount(total, currency) }}
            </p>
            <span class="mt-1 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-muted">{{ currency }}</span>
          </template>
        </DonutChart>

        <MonthBars
          v-else
          v-model:selected="selectedMonth"
          :items="monthTotals"
          :currency="currency"
          :color="type === 'expense' ? 'error' : 'success'"
          :up-is-good="type === 'income'"
          :label="`${typeName} over the last 6 months`"
          class="mt-4"
        />
      </section>

      <!-- Category list: share of the month + change vs last month; tapping one highlights it in the donut -->
      <section class="mt-8">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">All {{ typeName.toLowerCase() }}</h2>
          <p class="flex items-baseline gap-1.5 text-sm text-muted">
            Total
            <span class="font-display text-base font-semibold text-highlighted tabular-nums">
              {{ formatAmount(total, currency) }}
            </span>
          </p>
        </div>

        <p v-if="!byCategory.length" class="mt-3 rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted">
          No {{ typeName.toLowerCase() }} this month
        </p>

        <ul v-else class="mt-3 space-y-3">
          <li v-for="c in byCategory" :key="c.id">
            <button
              type="button"
              class="surface-card w-full rounded-2xl p-4 text-left transition-[transform,opacity] active:scale-[0.99] motion-reduce:active:scale-100"
              :class="selectedCategory !== null && selectedCategory !== c.id && view === 'donut' ? 'opacity-60' : ''"
              :aria-pressed="selectedCategory === c.id"
              @click="
                view = 'donut';
                selectedCategory = selectedCategory === c.id ? null : c.id;
              "
            >
              <div class="flex items-start gap-3">
                <IconTile :icon="c.icon" :color="c.color" size="sm" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-3">
                    <p class="truncate font-display font-bold tracking-tight text-highlighted">{{ c.name }}</p>
                    <p class="shrink-0 font-display font-semibold text-highlighted tabular-nums">
                      {{ formatAmount(c.total, currency) }}
                    </p>
                  </div>
                  <div class="mt-1 flex items-center justify-between gap-3">
                    <p class="text-sm text-muted tabular-nums">{{ percent(c.share) }} of total</p>
                    <p v-if="!c.last" class="shrink-0 text-xs text-muted">None last month</p>
                    <p v-else class="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      <span
                        class="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums"
                        :class="change(c).class"
                      >
                        <UIcon :name="change(c).icon" class="size-3" />
                        {{ change(c).label }}
                      </span>
                      vs last month
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-4 h-3 overflow-hidden rounded-full" :style="barTrackStyle(c.color)">
                <div
                  class="bar-grow h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  :style="barFillStyle(c.color, c.share, 4)"
                />
              </div>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

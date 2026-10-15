<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date";

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

// Month picker (UCalendar type="month"); future months are disabled
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const now = new Date();
const thisMonth = new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1);
const pickedMonth = shallowRef<CalendarDate>(thisMonth);
const monthPickerOpen = ref(false);

const month = computed(() => new Date(pickedMonth.value.year, pickedMonth.value.month - 1, 1));
const isFutureMonth = (d: DateValue) => d.year * 12 + d.month > thisMonth.year * 12 + thisMonth.month;

function onPickMonth(value: DateValue | undefined) {
  if (!value) return;
  pickedMonth.value = new CalendarDate(value.year, value.month, 1);
  monthPickerOpen.value = false;
}

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

// Transactions grouped by day, newest first ("Today", "Yesterday", "Wed, 14 Oct")
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFormat.format(date);
}
const days = computed(() => {
  const groups = new Map<string, { label: string; total: number; items: Transaction[] }>();
  for (const t of monthTransactions.value) {
    const key = t.date.toDateString();
    const group = groups.get(key) ?? { label: dayLabel(t.date), total: 0, items: [] };
    group.total += signed(t);
    group.items.push(t);
    groups.set(key, group);
  }
  return [...groups.values()];
});

const formatSigned = (minor: number) => `${minor > 0 ? "+" : ""}${formatMoney(minor, currency.value)}`;
</script>

<template>
  <div class="px-5 pt-[max(env(safe-area-inset-top),0.75rem)]">
    <!-- Top bar: logo + month picker (filters the whole screen) -->
    <header class="flex h-12 items-center justify-between">
      <img src="/logo.svg" alt="My Wallet" class="size-9 rounded-full" />
      <UPopover v-model:open="monthPickerOpen" :content="{ align: 'end', sideOffset: 8 }">
        <UButton
          :label="monthFormat.format(month)"
          icon="i-lucide-calendar"
          trailing-icon="i-lucide-chevron-down"
          color="neutral"
          variant="subtle"
          class="tabular-nums"
        />
        <template #content>
          <UCalendar
            type="month"
            :model-value="pickedMonth"
            :is-month-disabled="isFutureMonth"
            class="p-2"
            @update:model-value="onPickMonth"
          />
        </template>
      </UPopover>
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
              {{ formatMoney(income, currency) }}
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
              {{ formatMoney(expenses, currency) }}
            </p>
          </div>
        </div>
      </div>
    </WalletCard>

    <!-- Transactions -->
    <section class="mt-8">
      <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Transactions</h2>

      <!-- Empty: faded placeholder rows hint at the list to come, one short line on top -->
      <div v-if="!days.length" class="relative mt-3 overflow-hidden rounded-2xl bg-muted">
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

      <div v-for="day in days" :key="day.label" class="mt-5">
        <div class="flex items-baseline justify-between px-1 text-sm">
          <span class="font-medium text-muted">{{ day.label }}</span>
          <span class="tabular-nums text-dimmed">{{ formatSigned(day.total) }}</span>
        </div>

        <ul class="mt-2 divide-y divide-default rounded-2xl bg-muted">
          <li v-for="t in day.items" :key="t.id" class="flex items-center gap-3 px-4 py-3">
            <IconTile
              :icon="categoryById.get(t.categoryId)?.icon ?? 'i-lucide-tag'"
              :color="categoryById.get(t.categoryId)?.color"
              size="sm"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-highlighted">
                {{ categoryById.get(t.categoryId)?.name ?? "Uncategorized" }}
              </p>
              <p class="truncate text-sm text-muted">
                {{ walletById.get(t.accountId)?.name }}<template v-if="t.note"> · {{ t.note }}</template>
              </p>
            </div>
            <span
              class="shrink-0 font-display font-semibold tabular-nums"
              :class="t.type === 'income' ? 'text-success' : 'text-highlighted'"
            >
              {{ formatSigned(signed(t)) }}
            </span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

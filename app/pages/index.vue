<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// Wallets can use different currencies, so totals use the first wallet's currency
const currency = computed(() => wallets.value?.[0]?.currency ?? "USD");
const walletById = computed(() => new Map((wallets.value ?? []).map((w) => [w.id, w])));
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

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

// Month picker
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const month = ref(startOfMonth(new Date()));

const monthItems = computed<DropdownMenuItem[]>(() =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return {
      label: monthFormat.format(m),
      onSelect: () => (month.value = m),
    };
  }),
);

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
const net = computed(() => income.value - expenses.value);

// Transactions grouped by day, newest first
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const days = computed(() => {
  const groups = new Map<string, { label: string; total: number; items: Transaction[] }>();
  for (const t of monthTransactions.value) {
    const key = t.date.toDateString();
    const group = groups.get(key) ?? { label: dayFormat.format(t.date), total: 0, items: [] };
    group.total += signed(t);
    group.items.push(t);
    groups.set(key, group);
  }
  return [...groups.values()];
});

const formatSigned = (minor: number) => `${minor > 0 ? "+" : ""}${formatMoney(minor, currency.value)}`;
</script>

<template>
  <div>
    <!-- Hero: month picker + current balance -->
    <header class="aurora px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16 text-white">
      <div class="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <img src="/logo.svg" alt="" class="size-10 rounded-full ring-2 ring-white/25" />
        <div class="justify-self-center">
          <UDropdownMenu :items="monthItems" :content="{ align: 'center' }">
            <UButton
              :label="monthFormat.format(month)"
              trailing-icon="i-lucide-chevron-down"
              color="neutral"
              variant="ghost"
              class="bg-white/15 text-white hover:bg-white/25 active:bg-white/25"
            />
          </UDropdownMenu>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center gap-2 text-center">
        <p class="text-sm font-medium text-white/75">Current Balance</p>
        <p class="text-aurora text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums">
          <span
            v-for="(part, i) in formatMoneyParts(balance, currency)"
            :key="i"
            :class="part.isFraction && 'opacity-55'"
          >{{ part.value }}</span>
        </p>
        <p
          v-if="monthTransactions.length"
          class="mt-1 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 tabular-nums"
        >
          {{ formatSigned(net) }} this month
        </p>
      </div>
    </header>

    <!-- Content panel overlapping the hero -->
    <main class="relative -mt-8 space-y-6 rounded-t-4xl border-t border-white/10 bg-default px-4 pt-6">
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-highlighted">Your Money</h2>
        <div class="grid grid-cols-2 gap-3">
          <UCard>
            <IconTile icon="i-lucide-arrow-down-left" color="success" size="sm" />
            <p class="mt-4 text-sm text-muted">Income</p>
            <p class="mt-0.5 truncate text-xl font-semibold tabular-nums text-highlighted">
              {{ formatMoney(income, currency) }}
            </p>
          </UCard>
          <UCard>
            <IconTile icon="i-lucide-arrow-up-right" color="error" size="sm" />
            <p class="mt-4 text-sm text-muted">Expenses</p>
            <p class="mt-0.5 truncate text-xl font-semibold tabular-nums text-highlighted">
              {{ formatMoney(expenses, currency) }}
            </p>
          </UCard>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-highlighted">Transactions</h2>

        <UEmpty
          v-if="!days.length"
          icon="i-lucide-receipt"
          title="No transactions yet"
          description="Tap + to add your first income or expense."
          class="rounded-3xl bg-muted ring ring-default"
        />

        <div v-for="day in days" :key="day.label" class="space-y-2">
          <div class="flex items-baseline justify-between text-sm">
            <span class="text-muted">{{ day.label }}</span>
            <span class="text-muted">
              Total <span class="font-semibold tabular-nums text-highlighted">{{ formatSigned(day.total) }}</span>
            </span>
          </div>

          <UCard v-for="t in day.items" :key="t.id">
            <div class="flex items-center gap-3">
              <IconTile
                :icon="categoryById.get(t.categoryId)?.icon ?? 'i-lucide-tag'"
                :color="categoryById.get(t.categoryId)?.color"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-highlighted">
                  {{ categoryById.get(t.categoryId)?.name ?? "Uncategorized" }}
                </p>
                <p class="flex items-center gap-1 truncate text-sm text-muted">
                  <UIcon name="i-lucide-wallet" class="size-3.5 shrink-0" />
                  {{ walletById.get(t.accountId)?.name }}
                  <template v-if="t.note"> · {{ t.note }}</template>
                </p>
              </div>
              <span
                class="font-semibold tabular-nums"
                :class="t.type === 'income' ? 'text-success' : 'text-error'"
              >
                {{ formatSigned(signed(t)) }}
              </span>
            </div>
          </UCard>
        </div>
      </section>
    </main>
  </div>
</template>

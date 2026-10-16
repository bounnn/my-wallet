<script setup lang="ts">
// Home's calendar view of a month: a Monday-first grid where each day shows its income and expenses (short, e.g.
// "+1.2K" / "-350"), then the picked day's transactions and transfers. The month is [from, to), so a month that
// starts on another day than the 1st (Settings) spans two calendar months. Transfers aren't income or expenses,
// so they only show in the day's list.
const props = defineProps<{
  from: Date;
  to: Date;
  // The month's items, newest first
  items: (Transaction | Transfer)[];
  currency: string;
  walletId?: number;
  categoryById: Map<number, Category>;
  walletById: Map<number, Account>;
}>();
defineEmits<{ select: [item: Transaction | Transfer] }>();

const dayKey = (d: Date) => d.toDateString();
const todayKey = dayKey(new Date());

// Income and expense totals per day
const totals = computed(() => {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of props.items) {
    if (isTransfer(t)) continue;
    const key = dayKey(t.date);
    const day = map.get(key) ?? { income: 0, expense: 0 };
    day[t.type] += t.amount;
    map.set(key, day);
  }
  return map;
});

// Whole weeks around the month; days outside it are left blank
const cells = computed(() => {
  const now = new Date();
  const last = new Date(props.to.getFullYear(), props.to.getMonth(), props.to.getDate() - 1);
  const start = startOfWeek(props.from);
  const end = startOfWeek(last);
  const list = [];
  for (let d = start; d <= end || list.length % 7; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = dayKey(d);
    list.push({
      key,
      date: d,
      inMonth: d >= props.from && d < props.to,
      isToday: key === todayKey,
      isFuture: d > now,
      ...(totals.value.get(key) ?? { income: 0, expense: 0 }),
    });
  }
  return list;
});

// Mon … Sun, from a known Monday
const weekdays = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }),
);

// Short amounts that fit a day cell: 150000 → "150K"
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const short = (minor: number) => compact.format(fromMinor(minor, props.currency));

// Picked day: today when it's in the month, otherwise none until one is tapped
const picked = ref<string>();
watch(
  () => props.from.getTime(),
  () => {
    const today = cells.value.find((c) => c.isToday && c.inMonth);
    picked.value = today?.key;
  },
  { immediate: true },
);
const pickedCell = computed(() => cells.value.find((c) => c.key === picked.value));
// "2026-10-14", for the add screen's date
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pickedItems = computed(() => props.items.filter((t) => dayKey(t.date) === picked.value));

// Spending shade: days are tinted by their expenses against the month's biggest day (4 steps), so heavy days
// stand out at a glance. Full class names so Tailwind finds them.
const shades = ["", "bg-error/8", "bg-error/14", "bg-error/22", "bg-error/32"];
const maxExpense = computed(() => Math.max(0, ...cells.value.filter((c) => c.inMonth).map((c) => c.expense)));
const shade = (expense: number) =>
  expense && maxExpense.value ? shades[Math.max(1, Math.ceil((expense / maxExpense.value) * 4))] : "";
</script>

<template>
  <div>
    <div class="surface-card rounded-2xl p-2">
      <!-- Weekend letters a step dimmer -->
      <div class="grid grid-cols-7 pb-1" aria-hidden="true">
        <span
          v-for="(w, i) in weekdays"
          :key="i"
          class="py-1 text-center text-xs font-medium"
          :class="i >= 5 ? 'text-dimmed/60' : 'text-dimmed'"
          >{{ w }}</span
        >
      </div>
      <div class="grid grid-cols-7 gap-1">
        <template v-for="cell in cells" :key="cell.key">
          <!-- Days of the neighbouring months: just a faint number, so the weeks still read as weeks -->
          <span
            v-if="!cell.inMonth"
            aria-hidden="true"
            class="flex h-14 justify-center pt-1.5 text-xs font-medium text-dimmed/40 tabular-nums"
          >
            {{ cell.date.getDate() }}
          </span>
          <button
            v-else
            type="button"
            :aria-pressed="picked === cell.key"
            :aria-label="`${formatDate(cell.date)}${cell.isToday ? ', today' : ''}${cell.income ? `, income ${formatAmount(cell.income, currency)}` : ''}${cell.expense ? `, expenses ${formatAmount(cell.expense, currency)}` : ''}`"
            class="flex h-14 min-w-0 flex-col items-center rounded-xl px-0.5 pt-1.5 transition-[background-color,transform,box-shadow] duration-150 active:scale-95 motion-reduce:active:scale-100"
            :class="[
              shade(cell.expense),
              picked === cell.key ? 'ring-2 ring-primary ring-inset' : !cell.expense && 'active:bg-elevated',
              cell.isFuture && 'opacity-40',
            ]"
            @click="picked = cell.key"
          >
            <span
              class="flex h-5 items-center justify-center text-xs tabular-nums"
              :class="cell.isToday ? 'font-bold text-primary' : 'font-semibold text-highlighted'"
            >
              {{ cell.date.getDate() }}
            </span>
            <span
              v-if="cell.income"
              class="mt-0.5 max-w-full truncate text-[0.625rem] leading-tight font-medium text-success tabular-nums"
            >
              +{{ short(cell.income) }}
            </span>
            <span
              v-if="cell.expense"
              class="max-w-full truncate text-[0.625rem] leading-tight font-medium text-toned tabular-nums"
              :class="!cell.income && 'mt-0.5'"
            >
              -{{ short(cell.expense) }}
            </span>
          </button>
        </template>
      </div>

      <!-- Key for the spending shade -->
      <div class="flex items-center justify-end gap-1.5 px-1 pt-2.5 pb-0.5 text-[0.6875rem] text-muted" aria-hidden="true">
        <span>Spent less</span>
        <span v-for="s in shades.slice(1)" :key="s" class="size-3 rounded-sm" :class="s" />
        <span>More</span>
      </div>
    </div>

    <!-- The picked day's items, like a day in the date list -->
    <div v-if="pickedCell" class="surface-card mt-3 overflow-hidden rounded-2xl">
      <div class="flex items-center justify-between gap-3 bg-accented/70 px-4 py-2 text-sm">
        <span class="flex items-baseline gap-2">
          <span class="font-semibold text-highlighted">{{ weekdayLabel(pickedCell.date) }}</span>
          <span v-if="!weekdayLabel(pickedCell.date).includes('/')" class="text-xs text-muted tabular-nums">
            {{ formatDayMonth(pickedCell.date) }}
          </span>
        </span>
        <!-- In and out apart, like the cell -->
        <span class="flex items-baseline gap-3 font-medium tabular-nums">
          <span v-if="pickedCell.income" class="text-success">+{{ formatAmount(pickedCell.income, currency) }}</span>
          <span v-if="pickedCell.expense" class="text-toned">-{{ formatAmount(pickedCell.expense, currency) }}</span>
        </span>
      </div>
      <ul v-if="pickedItems.length" class="divide-y divide-default">
        <template v-for="t in pickedItems" :key="isTransfer(t) ? `transfer-${t.id}` : t.id">
          <TransferRow
            v-if="isTransfer(t)"
            :transfer="t"
            :wallet-id="walletId"
            :wallet-by-id="walletById"
            hide-currency
            @select="$emit('select', $event)"
          />
          <TransactionRow
            v-else
            :transaction="t"
            :category="categoryById.get(t.categoryId)"
            :wallet="walletById.get(t.accountId)"
            hide-currency
            @select="$emit('select', $event)"
          />
        </template>
      </ul>
      <!-- Empty day, like the app's other empty lists: faded placeholder rows, what's missing, and (for a past
           day or today) a way to add one straight on that date -->
      <div v-else>
        <ul aria-hidden="true" class="divide-y divide-default mask-[linear-gradient(to_bottom,black,transparent)]">
          <li v-for="i in 2" :key="i" class="flex items-center gap-3 px-4 py-3">
            <span class="size-10 shrink-0 rounded-2xl bg-elevated" />
            <span class="flex-1 space-y-2">
              <span class="block h-2.5 rounded-full bg-elevated" :class="i === 1 ? 'w-28' : 'w-20'" />
              <span class="block h-2 w-16 rounded-full bg-elevated/60" />
            </span>
            <span class="h-2.5 w-14 rounded-full bg-elevated" />
          </li>
        </ul>
        <div class="flex flex-col items-center px-6 pb-6 text-center">
          <p class="font-display font-semibold text-highlighted">
            {{ pickedCell.isFuture ? "This day hasn't come yet" : "Nothing on this day" }}
          </p>
          <UButton
            v-if="!pickedCell.isFuture"
            :to="`/add?date=${isoDay(pickedCell.date)}`"
            label="Add to this day"
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            class="mt-4 h-11 justify-center bg-elevated px-5"
          />
        </div>
      </div>
    </div>
    <p v-else class="mt-3 text-center text-sm text-muted">Tap a day to see what happened</p>
  </div>
</template>

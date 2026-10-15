<script setup lang="ts">
// Collapsible block of transactions (a week): header with label, range/count and net total,
// then the transactions split by day. Meant to sit inside a .surface-card.
const props = defineProps<{
  label: string;
  sublabel: string;
  days: TransactionDay[];
  currency: string;
  categoryById: Map<number, Category>;
  walletById: Map<number, Account>;
  // Skip the code on the header and rows when the screen already shows the currency
  hideCurrency?: boolean;
}>();
const open = defineModel<boolean>("open", { default: false });

const total = computed(() => props.days.reduce((s, d) => s + d.total, 0));
const count = computed(() => props.days.reduce((s, d) => s + d.items.length, 0));
// Day subtotals skip the currency: the group header right above (or the screen) shows it
const formatSigned = (minor: number) => `${minor > 0 ? "+" : ""}${formatAmount(minor, props.currency)}`;
</script>

<template>
  <UCollapsible v-model:open="open">
    <button type="button" class="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2 font-display font-semibold text-highlighted">
          {{ label }}
          <span
            class="rounded-md bg-elevated px-1.5 py-0.5 font-sans text-xs font-medium text-toned tabular-nums"
            :aria-label="`${count} ${count === 1 ? 'transaction' : 'transactions'}`"
          >{{ count }}</span>
        </p>
        <p class="text-xs text-dimmed tabular-nums">{{ sublabel }}</p>
      </div>
      <MoneyAmount
        :amount="total"
        :currency="currency"
        signed
        :hide-currency="hideCurrency"
        align="end"
        class="shrink-0"
        currency-class="text-[0.6875rem] text-dimmed"
        :amount-class="['text-sm font-semibold', total > 0 ? 'text-success' : 'text-muted'].join(' ')"
      />
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 shrink-0 text-dimmed transition-transform duration-200 motion-reduce:transition-none"
        :class="open && 'rotate-180'"
      />
    </button>

    <template #content>
      <div v-for="day in days" :key="day.key" class="border-t border-default">
        <!-- Solid day bar so days stay easy to find with every group expanded -->
        <div class="flex items-center justify-between gap-3 bg-accented/70 px-4 py-2 text-sm">
          <span class="flex items-baseline gap-2">
            <span class="font-semibold text-highlighted">{{ day.label }}</span>
            <!-- "Today" / "Yesterday" also get their date -->
            <span v-if="!day.label.includes('/')" class="text-xs text-muted tabular-nums">
              {{ formatDayMonth(day.date) }}
            </span>
          </span>
          <span class="font-medium text-toned tabular-nums">{{ formatSigned(day.total) }}</span>
        </div>
        <ul class="divide-y divide-default">
          <TransactionRow
            v-for="t in day.items"
            :key="t.id"
            :transaction="t"
            :category="categoryById.get(t.categoryId)"
            :wallet="walletById.get(t.accountId)"
            :hide-currency="hideCurrency"
          />
        </ul>
      </div>
    </template>
  </UCollapsible>
</template>

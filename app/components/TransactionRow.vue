<script setup lang="ts">
// One transaction line: category tile, category name, note (when there is one), signed amount.
// The wallet is still needed for its currency.
const props = defineProps<{ transaction: Transaction; category?: Category; wallet?: Account; hideCurrency?: boolean }>();

const signed = computed(() =>
  props.transaction.type === "income" ? props.transaction.amount : -props.transaction.amount,
);
const currency = computed(() => props.wallet?.currency ?? "USD");
</script>

<template>
  <li class="flex items-center gap-3 px-4 py-3">
    <IconTile :icon="category?.icon ?? 'i-lucide-tag'" :color="category?.color" size="sm" />
    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-highlighted">{{ category?.name ?? "Uncategorized" }}</p>
      <p v-if="transaction.note" class="truncate text-sm text-muted">{{ transaction.note }}</p>
    </div>
    <MoneyAmount
      :amount="signed"
      :currency="currency"
      signed
      :hide-currency="hideCurrency"
      align="end"
      class="shrink-0"
      :amount-class="['font-semibold', transaction.type === 'income' ? 'text-success' : 'text-highlighted'].join(' ')"
    />
  </li>
</template>

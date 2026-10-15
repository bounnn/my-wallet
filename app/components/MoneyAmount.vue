<script setup lang="ts">
// Amount with its currency code on a small muted line above, e.g.  LAK / -1,000
const props = withDefaults(
  defineProps<{
    amount: number;
    currency: string;
    // Show "+" for positive amounts (negatives always get "-")
    signed?: boolean;
    align?: "start" | "end";
    amountClass?: string;
    currencyClass?: string;
  }>(),
  { align: "start", amountClass: "font-semibold", currencyClass: "text-xs text-muted" },
);

const text = computed(() => `${props.signed && props.amount > 0 ? "+" : ""}${formatAmount(props.amount, props.currency)}`);
</script>

<template>
  <span class="flex min-w-0 flex-col" :class="align === 'end' ? 'items-end text-right' : 'items-start'">
    <span class="font-medium" :class="currencyClass">{{ currency }}</span>
    <span class="max-w-full truncate font-display tabular-nums" :class="amountClass">{{ text }}</span>
  </span>
</template>

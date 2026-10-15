<script setup lang="ts">
// The add screen's amount, typed on the keypad: label (or `error`) and currency on top, then the big signed number,
// or the calculator sum while one is typed. A blinking caret shows while the keypad is up (`typing`).
const props = defineProps<{
  text: string;
  currency: string;
  type: Transaction["type"];
  typing?: boolean;
  error?: string | boolean;
}>();

const isExpression = computed(() => hasOperator(props.text));
const shown = computed(() => (isExpression.value ? formatExpression(props.text) : formatAmountInput(props.text)));
// Shrinks as it gets longer, so it never wraps
const size = computed(() => (shown.value.length > 14 ? "text-3xl" : shown.value.length > 9 ? "text-4xl" : "text-5xl"));
const tone = computed(() =>
  !props.text
    ? "text-dimmed"
    : isExpression.value
      ? "text-toned"
      : props.type === "income"
        ? "text-success"
        : "text-highlighted",
);
</script>

<template>
  <div class="px-4 pt-3 pb-4">
    <div class="flex items-center justify-between">
      <span class="text-sm" :class="error ? 'text-error' : 'text-muted'">{{ error || "Amount" }}</span>
      <span class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned">{{ currency }}</span>
    </div>
    <div class="mt-1 flex h-14 items-center">
      <p class="flex min-w-0 flex-1 items-baseline gap-1.5 font-display font-bold tracking-tight tabular-nums" aria-live="polite">
        <span class="text-2xl text-dimmed">{{ currencySymbol(currency) }}</span>
        <span class="truncate transition-colors" :class="[size, tone]"
          ><template v-if="!isExpression">{{ type === "income" ? "+" : "-" }}</template>{{ shown }}</span
        >
        <span v-if="typing" class="caret h-9 w-0.5 self-center rounded-full bg-primary" aria-hidden="true" />
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Blinking caret: the amount is the field being typed into */
.caret {
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}
</style>

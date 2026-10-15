<script setup lang="ts">
// In-app number pad for entering amounts; edits a plain string like "1250.5".
// `calculator` adds a ÷ × - + column, so the string can be an expression like "12.5+3×2" (see utils/calc.ts).
// `tiles` draws each key as a raised tile, for a keypad docked on a bg-muted panel.
const props = defineProps<{ decimals: number; maxLength?: number; tiles?: boolean; calculator?: boolean }>();
const model = defineModel<string>({ required: true });

type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back" | "clear" | "=" | Operator;
// Calculator: 0 spans two columns and = two rows, like a standard calculator
const keys = computed<Key[]>(() =>
  props.calculator
    ? ["clear", "÷", "×", "back", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."]
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"],
);

const labels: Partial<Record<Key, string>> = {
  back: "Delete",
  clear: "Clear",
  "=": "Equals",
  ".": "Decimal point",
  "+": "Plus",
  "-": "Minus",
  "×": "Times",
  "÷": "Divided by",
};

function press(key: Key) {
  const value = model.value;
  // The number being typed: everything after the last operator
  const number = value.split(/[+\-×÷]/).at(-1) ?? "";
  // Tiny haptic tick where supported (Android)
  navigator.vibrate?.(8);

  if (key === "back") {
    model.value = value.slice(0, -1);
    return;
  }
  if (key === "clear") {
    model.value = "";
    return;
  }
  if (key === "=") {
    // Replace the expression with its result, rounded to the currency's decimals.
    // Negative results are left alone: "-7" would read as a leading minus operator.
    if (!hasOperator(value)) return;
    const result = evaluateExpression(value);
    if (Number.isFinite(result) && result >= 0) model.value = String(Number(result.toFixed(props.decimals)));
    return;
  }
  if (isOperator(key)) {
    if (!value) return;
    // A second operator in a row replaces the first
    model.value = (isOperator(value.at(-1)) ? value.slice(0, -1) : value) + key;
    return;
  }
  if (key === ".") {
    if (props.decimals === 0 || number.includes(".")) return;
    model.value = value + (number ? "." : "0.");
    return;
  }

  const [, fraction] = number.split(".");
  if (fraction !== undefined && fraction.length >= props.decimals) return;
  if (number.replace(".", "").length >= (props.maxLength ?? 12)) return;
  model.value = number === "0" ? value.slice(0, -1) + key : value + key;
}

// Long-press backspace clears everything; long enough that a resting thumb doesn't trigger it
let clearTimer: ReturnType<typeof setTimeout> | undefined;
function startClear() {
  clearTimer = setTimeout(() => (model.value = ""), 800);
}
function stopClear() {
  clearTimeout(clearTimer);
}
</script>

<template>
  <div
    class="grid"
    :class="[calculator ? 'auto-rows-[2.75rem] grid-cols-4' : 'grid-cols-3', tiles ? 'gap-1.5' : 'gap-1']"
    role="group"
    :aria-label="calculator ? 'Calculator' : 'Number pad'"
  >
    <button
      v-for="key in keys"
      :key="key"
      type="button"
      class="flex items-center justify-center font-display text-2xl font-medium transition-colors select-none disabled:opacity-0"
      :class="[
        calculator ? 'rounded-xl' : tiles ? 'h-12 rounded-xl' : 'h-14 rounded-2xl',
        calculator && key === '0' && 'col-span-2',
        key === '=' && 'row-span-2',
        // = lights up while a sum is waiting for its total
        key === '='
          ? hasOperator(model)
            ? 'btn-primary-gradient text-white'
            : 'bg-primary/15 text-navy-200 active:bg-primary/30'
          : isOperator(key)
          ? 'bg-primary/15 text-navy-200 active:bg-primary/30'
          : key === 'clear'
            ? 'bg-elevated text-error active:bg-accented'
            : tiles
            ? 'bg-elevated text-highlighted active:bg-accented'
            : 'text-highlighted active:bg-elevated',
      ]"
      :disabled="key === '.' && decimals === 0"
      :aria-label="labels[key] ?? key"
      @click="press(key)"
      @pointerdown="key === 'back' && startClear()"
      @pointerup="stopClear"
      @pointerleave="stopClear"
    >
      <UIcon v-if="key === 'back'" name="i-lucide-delete" class="size-6" />
      <template v-else-if="key === 'clear'">C</template>
      <template v-else>{{ key }}</template>
    </button>
  </div>
</template>

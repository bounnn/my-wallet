<script setup lang="ts">
// Typed money field styled like the add screen's amount block: label (or error) and currency chip on top,
// a big Sora number below. Groups with "," as you type. Meant for a row inside a bg-elevated card.
const props = defineProps<{ label: string; currency: string; error?: string }>();
const model = defineModel<string>({ required: true });

// Same sizes as the add screen's amount, shrinking as it gets longer. Marked important (!) to beat
// main.css's 16px input rule for touch screens, which is there to stop iOS zooming in on small fields.
const size = computed(() =>
  model.value.length > 14 ? "text-3xl!" : model.value.length > 9 ? "text-4xl!" : "text-5xl!",
);

// Write the regrouped text straight back to the field, so it also updates when it equals the old value
// (e.g. a typed letter is dropped)
function onInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const grouped = groupAmountInput(input.value, props.currency);
  input.value = grouped;
  model.value = grouped;
}
</script>

<template>
  <label class="block px-4 pt-3 pb-4">
    <span class="flex items-center justify-between">
      <span class="text-sm" :class="error ? 'text-error' : 'text-muted'">{{ error ?? label }}</span>
      <span class="rounded-md bg-accented px-2 py-0.5 text-xs font-medium text-toned">{{ currency }}</span>
    </span>
    <span class="mt-1 flex items-baseline gap-1.5 font-display font-bold tracking-tight tabular-nums">
      <span class="text-2xl text-dimmed">{{ currencySymbol(currency) }}</span>
      <input
        :value="model"
        placeholder="0"
        inputmode="decimal"
        maxlength="20"
        autocomplete="off"
        enterkeyhint="done"
        :aria-label="label"
        :aria-invalid="!!error"
        class="h-14 min-w-0 flex-1 bg-transparent text-highlighted caret-primary outline-none placeholder:text-dimmed"
        :class="size"
        @input="onInput"
      />
    </span>
  </label>
</template>

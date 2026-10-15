<script setup lang="ts">
// Typed money field styled like the add screen's amount block: label and currency chip on top, a big Sora number
// below. Groups with "," as you type. Meant for a row inside a bg-elevated card, inside a UForm; its validation
// error for `name` takes the label's place (screen readers get it from the field itself).
const props = defineProps<{ name: string; label: string; currency: string }>();
const model = defineModel<string>({ required: true });

// Same sizes as the add screen's amount, shrinking as it gets longer. Marked important (!) to beat
// main.css's 16px input rule for touch screens, which is there to stop iOS zooming in on small fields.
const size = computed(() =>
  model.value.length > 14 ? "text-3xl!" : model.value.length > 9 ? "text-4xl!" : "text-5xl!",
);

// Write the regrouped text straight back to the field too, so it also updates when it equals the old value
// (e.g. a typed letter is dropped)
const input = useTemplateRef("input");
function onUpdate(value: string | number | null | undefined) {
  const grouped = groupAmountInput(String(value ?? ""), props.currency);
  model.value = grouped;
  const el = input.value?.inputRef;
  if (el && el.value !== grouped) el.value = grouped;
}
</script>

<template>
  <UFormField :name="name" :ui="{ error: 'sr-only' }">
    <template #default="{ error }">
      <label class="block px-4 pt-3 pb-4">
        <span class="flex items-center justify-between">
          <span class="text-sm" :class="error ? 'text-error' : 'text-muted'" aria-hidden="true">{{ error || label }}</span>
          <span class="rounded-md bg-accented px-2 py-0.5 text-xs font-medium text-toned">{{ currency }}</span>
        </span>
        <span class="mt-1 flex items-baseline gap-1.5 font-display font-bold tracking-tight tabular-nums">
          <span class="text-2xl text-dimmed">{{ currencySymbol(currency) }}</span>
          <UInput
            ref="input"
            :model-value="model"
            variant="none"
            placeholder="0"
            inputmode="decimal"
            :maxlength="20"
            autocomplete="off"
            enterkeyhint="done"
            :aria-label="label"
            class="min-w-0 flex-1"
            :ui="{ base: ['h-14 p-0 caret-primary ring-0', size] }"
            @update:model-value="onUpdate"
          />
        </span>
      </label>
    </template>
  </UFormField>
</template>

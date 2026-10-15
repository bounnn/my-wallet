<script setup lang="ts">
// In-app number pad for entering amounts; edits a plain string like "1250.5"
const props = defineProps<{ decimals: number; maxLength?: number }>();
const model = defineModel<string>({ required: true });

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

function press(key: (typeof keys)[number]) {
  const value = model.value;
  // Tiny haptic tick where supported (Android)
  navigator.vibrate?.(8);

  if (key === "back") {
    model.value = value.slice(0, -1);
    return;
  }
  if (key === ".") {
    if (props.decimals === 0 || value.includes(".")) return;
    model.value = (value || "0") + ".";
    return;
  }

  const [, fraction] = value.split(".");
  if (fraction !== undefined && fraction.length >= props.decimals) return;
  if (value.replace(".", "").length >= (props.maxLength ?? 12)) return;
  model.value = value === "0" ? key : value + key;
}

// Long-press backspace clears everything
let clearTimer: ReturnType<typeof setTimeout> | undefined;
function startClear() {
  clearTimer = setTimeout(() => (model.value = ""), 500);
}
function stopClear() {
  clearTimeout(clearTimer);
}
</script>

<template>
  <div class="grid grid-cols-3 gap-1" role="group" aria-label="Number pad">
    <button
      v-for="key in keys"
      :key="key"
      type="button"
      class="flex h-14 items-center justify-center rounded-2xl font-display text-2xl font-medium text-highlighted transition-colors select-none active:bg-elevated disabled:opacity-0"
      :disabled="key === '.' && decimals === 0"
      :aria-label="key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key"
      @click="press(key)"
      @pointerdown="key === 'back' && startClear()"
      @pointerup="stopClear"
      @pointerleave="stopClear"
    >
      <UIcon v-if="key === 'back'" name="i-lucide-delete" class="size-6" />
      <template v-else>{{ key }}</template>
    </button>
  </div>
</template>

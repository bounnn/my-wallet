<script setup lang="ts">
// Category color dots (category and goal forms); 44px targets in a 5-column grid
const color = defineModel<CategoryColor>({ required: true });
</script>

<template>
  <div class="mt-2 grid grid-cols-5 justify-items-center gap-y-3" role="radiogroup" aria-label="Color">
    <button
      v-for="(swatch, key) in colorSwatches"
      :key="key"
      type="button"
      role="radio"
      :aria-checked="key === color"
      :aria-label="swatch.label"
      class="flex size-11 items-center justify-center rounded-full transition-transform"
      :class="[swatch.class, key === color ? 'scale-105 ring-2 ring-white/80 ring-offset-2 ring-offset-(--ui-bg-muted)' : '']"
      @click="color = key"
    >
      <UIcon v-if="key === color" name="i-lucide-check" class="size-5 text-midnight-950" />
    </button>
  </div>
</template>

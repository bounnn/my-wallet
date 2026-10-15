<script setup lang="ts">
// Small ring with the percent in the middle (ui/ref1 plan budgets). The arc sweeps in on mount;
// past 100% the ring stays full and the label shows the real percent.
const props = withDefaults(defineProps<{ value: number; color?: CategoryColor; label?: string }>(), {
  color: "primary",
});

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const grown = ref(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (grown.value = true))));

const share = computed(() => Math.min(Math.max(props.value, 0), 1));
const dash = computed(() => `${grown.value ? share.value * CIRCUMFERENCE : 0} ${CIRCUMFERENCE}`);
const percent = computed(() => `${Math.round(props.value * 100)}%`);
</script>

<template>
  <div class="relative size-14 shrink-0" role="img" :aria-label="label ?? percent">
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="size-full -rotate-90">
      <circle
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="RADIUS"
        fill="none"
        :stroke-width="STROKE"
        :style="{ stroke: `color-mix(in oklab, var(--ui-${color}) 16%, transparent)` }"
      />
      <circle
        v-if="share > 0"
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="RADIUS"
        fill="none"
        :stroke-width="STROKE"
        stroke-linecap="round"
        :stroke-dasharray="dash"
        class="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        :style="{ stroke: `var(--ui-${color})` }"
      />
    </svg>
    <span
      class="absolute inset-0 flex items-center justify-center font-display text-xs font-bold tabular-nums"
      :style="{ color: `var(--ui-${color})` }"
      aria-hidden="true"
    >{{ percent }}</span>
  </div>
</template>

<script setup lang="ts">
// Donut of rounded segments with gaps (ui/ref1 report). Tap a segment to select it; the center slot shows
// the total or the selected segment. Colors follow the category, so the list below doubles as the legend.
// Styled like the category progress bars: each fill fades in from soft to full color, and segments sweep in on mount.
export interface DonutSegment {
  id: number;
  label: string;
  value: number;
  color: CategoryColor;
  // Read out with the label, e.g. "1,250.00 USD, 32%"
  valueLabel?: string;
}

// `label` is read out for the chart as a whole
const props = defineProps<{ segments: DonutSegment[]; label: string }>();
const selected = defineModel<number | null>("selected", { default: null });

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE = 26;
const STROKE_SELECTED = 34;
// Arc length left empty between two segments
const GAP = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const id = useId();

// Start with empty dashes, then grow to full length (the dash transition does the sweep)
const grown = ref(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (grown.value = true))));

const point = (length: number) => {
  const angle = (length / CIRCUMFERENCE) * 2 * Math.PI;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
};

const arcs = computed(() => {
  const total = props.segments.reduce((s, x) => s + x.value, 0);
  if (!total) return [];
  const single = props.segments.length === 1;
  let start = 0;
  return props.segments.map((segment) => {
    const span = (segment.value / total) * CIRCUMFERENCE;
    const width = segment.id === selected.value ? STROKE_SELECTED : STROKE;
    // Round caps stick out width/2 at each end, so take that off the dash; slivers too short for caps stay square
    const roundLength = span - GAP - width;
    const round = !single && roundLength > 0;
    const length = single ? CIRCUMFERENCE : round ? roundLength : Math.max(span - GAP, 1.5);
    const offset = single ? 0 : start + GAP / 2 + (round ? width / 2 : 0);
    // Gradient runs from the segment's start to its end (across the ring when it's the only one)
    const from = single ? { x: CENTER + RADIUS, y: CENTER } : point(start);
    const to = single ? { x: CENTER - RADIUS, y: CENTER } : point(start + span);
    const arc = {
      ...segment,
      width,
      cap: round ? ("round" as const) : ("butt" as const),
      dash: `${grown.value ? length : 0} ${CIRCUMFERENCE}`,
      offset: -offset,
      from,
      to,
    };
    start += span;
    return arc;
  });
});


function toggle(segmentId: number) {
  selected.value = selected.value === segmentId ? null : segmentId;
}
</script>

<template>
  <div class="relative mx-auto aspect-square w-full max-w-64">
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="size-full" role="group" :aria-label="label">
      <!-- Empty month: a plain track ring -->
      <circle
        v-if="!arcs.length"
        :cx="CENTER"
        :cy="CENTER"
        :r="RADIUS"
        fill="none"
        :stroke-width="STROKE"
        class="stroke-(--ui-bg-elevated)"
      />
      <g :transform="`rotate(-90 ${CENTER} ${CENTER})`">
        <defs>
          <linearGradient
            v-for="arc in arcs"
            :id="`${id}-${arc.id}`"
            :key="arc.id"
            gradientUnits="userSpaceOnUse"
            :x1="arc.from.x"
            :y1="arc.from.y"
            :x2="arc.to.x"
            :y2="arc.to.y"
          >
            <stop offset="0" :style="{ stopColor: colorMix(arc.color, 45) }" />
            <stop offset="1" :style="{ stopColor: colorVar(arc.color) }" />
          </linearGradient>
        </defs>

        <circle
          v-for="arc in arcs"
          :key="arc.id"
          :cx="CENTER"
          :cy="CENTER"
          :r="RADIUS"
          fill="none"
          :style="{ stroke: `url(#${id}-${arc.id})` }"
          :stroke-width="arc.width"
          :stroke-linecap="arc.cap"
          :stroke-dasharray="arc.dash"
          :stroke-dashoffset="arc.offset"
          :opacity="selected === null || selected === arc.id ? 1 : 0.3"
          role="button"
          tabindex="0"
          :aria-label="arc.valueLabel ? `${arc.label}, ${arc.valueLabel}` : arc.label"
          :aria-pressed="selected === arc.id"
          class="cursor-pointer outline-none transition-[stroke-dasharray,stroke-dashoffset,stroke-width,opacity] duration-700 ease-out focus-visible:opacity-100 focus-visible:[filter:drop-shadow(0_0_2px_white)_drop-shadow(0_0_1px_white)] motion-reduce:transition-none"
          @click="toggle(arc.id)"
          @keydown.enter.prevent="toggle(arc.id)"
          @keydown.space.prevent="toggle(arc.id)"
        />
      </g>
    </svg>

    <!-- Center readout; pointer-events off so taps reach the ring -->
    <div class="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center text-center">
      <slot />
    </div>
  </div>
</template>

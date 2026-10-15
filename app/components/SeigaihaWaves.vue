<script setup lang="ts">
// Seigaiha (青海波): rows of overlapping concentric wave arcs, drawn as faint white lines that fade out from the
// top-right corner, so the card's text stays clear. Each scale hides the lines of the row above it (that
// overlap is what makes the waves), done inside a mask so the card's gradient still shows between the lines.
const id = useId();

// Card-shaped canvas (1.586 ratio); R is the scale radius, rows step R/2 down, every other row shifts by R
const W = 320;
const H = 202;
const R = 20;
const RINGS = [4, 8, 12, 16];
// Only scales near the corner are drawn, everything further out is faded away anyway
const REACH = 190;

const scales: { x: number; y: number }[] = [];
for (let row = 0; row * (R / 2) <= H + R; row++) {
  const y = row * (R / 2);
  for (let x = (row % 2) * R - R; x <= W + R; x += 2 * R) {
    if (Math.hypot(W - x, y) < REACH) scales.push({ x, y });
  }
}
</script>

<template>
  <svg
    aria-hidden="true"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="xMaxYMin slice"
    class="pointer-events-none absolute inset-0 size-full rounded-[inherit]"
  >
    <defs>
      <!-- One scale: a black disc hides whatever is behind it, then its white arcs -->
      <g :id="`${id}-scale`">
        <circle :r="R" fill="black" stroke="white" stroke-width="1.2" />
        <circle v-for="r in RINGS" :key="r" :r="r" fill="none" stroke="white" stroke-width="1.2" />
      </g>
      <mask :id="`${id}-lines`" maskUnits="userSpaceOnUse" x="0" y="0" :width="W" :height="H">
        <rect :width="W" :height="H" fill="black" />
        <!-- Top rows first, so each row covers the one above it -->
        <use v-for="(s, i) in scales" :key="i" :href="`#${id}-scale`" :x="s.x" :y="s.y" />
      </mask>
      <radialGradient :id="`${id}-fade`" :cx="W" cy="0" :r="REACH" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="white" stop-opacity="0.22" />
        <stop offset="0.5" stop-color="white" stop-opacity="0.09" />
        <stop offset="1" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect :width="W" :height="H" :fill="`url(#${id}-fade)`" :mask="`url(#${id}-lines)`" />
  </svg>
</template>

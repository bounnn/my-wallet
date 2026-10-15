<script setup lang="ts">
// Navy wallet card (ui/ref6.png): seigaiha waves in the top-right corner, name on top, balance at the bottom,
// optional footer slot. With `tilt` it leans with the phone, a light reflection slides across it and a glow
// underneath drifts the other way (on iOS, the first tap on the page turns the motion on).
const props = withDefaults(
  defineProps<{ name: string; currency: string; balance: number; label?: string; tilt?: boolean }>(),
  { label: "Account balance" },
);

const root = useTemplateRef<HTMLElement>("root");
if (props.tilt) useDeviceTilt(root);
</script>

<template>
  <div ref="root" class="relative w-full">
    <div
      v-if="tilt"
      aria-hidden="true"
      class="tilt-glow pointer-events-none absolute -inset-x-4 top-4 -bottom-10"
    />
    <!-- No overflow-hidden: the card keeps its 1.586 ratio but can grow if the footer needs more room -->
    <div
      class="card-finish navy-card relative isolate aspect-[1.586] w-full rounded-2xl p-5 text-white shadow-[0_24px_48px_-16px_rgb(17_31_87/0.8)] ring-1 ring-inset ring-white/10"
      :class="tilt && 'tilt-card'"
    >
      <!-- Waves and light reflection clipped to the rounded corners. Safari doesn't round an <svg>'s content, and
           while the card is tilting it drops overflow clipping on rounded corners unless there's a mask -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] [-webkit-mask-image:-webkit-radial-gradient(white,black)]"
      >
        <SeigaihaWaves />
        <div v-if="tilt" class="tilt-shine absolute inset-0" />
      </div>

      <div class="relative flex h-full flex-col">
        <span class="truncate font-display text-lg font-semibold">{{ name || "Main Wallet" }}</span>

        <div class="mt-auto">
          <!-- Currency sits in the muted line above the number; on home it's the only place it's shown -->
          <p class="flex items-center gap-2 text-sm text-white/70">
            {{ label }}
            <span class="rounded-md bg-white/12 px-1.5 py-0.5 text-xs font-medium text-white/80">{{ currency }}</span>
          </p>
          <p class="mt-1 truncate font-display text-3xl font-bold tracking-tight tabular-nums">
            {{ formatAmount(balance, currency) }}
          </p>
        </div>

        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --tilt-x / --tilt-y (-1..1) come from useDeviceTilt */
.tilt-card {
  transform: perspective(900px) rotateX(calc(var(--tilt-y, 0) * -12deg)) rotateY(calc(var(--tilt-x, 0) * 12deg));
}
/* Light reflection: a soft spot that slides against the lean, like light catching a real card. Plain white, no
   blend mode: the clipping mask around it isolates it from the card, so overlay would have nothing to blend with */
.tilt-shine {
  background: radial-gradient(
    circle at calc(50% - var(--tilt-x, 0) * 55%) calc(15% - var(--tilt-y, 0) * 70%),
    rgb(255 255 255 / 0.16),
    transparent 55%
  );
}
/* Glow under the card, drifting against the lean. A gradient, not filter: blur() — Safari clips a moving blurred
   element to its layer box, so the glow would flash with square edges */
.tilt-glow {
  background: radial-gradient(closest-side, rgb(36 72 196 / 0.55), rgb(36 72 196 / 0.25) 50%, transparent);
  transform: translate(calc(var(--tilt-x, 0) * -16px), calc(var(--tilt-y, 0) * -12px));
}
</style>

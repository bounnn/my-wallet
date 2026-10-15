<script setup lang="ts">
// Navy wallet card (ui/ref6.png): name + coin stack on top, balance at the bottom, optional footer slot
withDefaults(defineProps<{ name: string; currency: string; balance: number; label?: string }>(), {
  label: "Account balance",
});
</script>

<template>
  <!-- No overflow-hidden: the card keeps its 1.586 ratio but can grow if the footer needs more room -->
  <div
    class="card-finish navy-card relative isolate aspect-[1.586] w-full rounded-2xl p-5 text-white shadow-[0_24px_48px_-16px_rgb(17_31_87/0.8)] ring-1 ring-inset ring-white/10"
  >
    <div class="flex h-full flex-col">
      <div class="flex items-start justify-between gap-3">
        <span class="truncate font-display text-lg font-semibold">{{ name || "Main Wallet" }}</span>
        <CoinStack class="-mt-1 -mr-1" />
      </div>

      <div class="mt-auto">
        <!-- Currency sits in the muted line above the number, like every amount in the app -->
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
</template>

<script setup lang="ts">
// Navy wallet card (ui/ref6.png): name + coin stack on top, balance at the bottom
defineProps<{ name: string; currency: string; balance: number }>();
</script>

<template>
  <div
    class="card-finish navy-card relative isolate aspect-[1.586] w-full overflow-hidden rounded-2xl p-5 text-white shadow-[0_24px_48px_-16px_rgb(17_31_87/0.8)] ring-1 ring-inset ring-white/10"
  >
    <div class="flex h-full flex-col">
      <div class="flex items-start justify-between gap-3">
        <span class="truncate font-display text-lg font-semibold">{{ name || "Main Wallet" }}</span>
        <CoinStack class="-mt-1 -mr-1" />
      </div>

      <div class="mt-auto">
        <p class="text-sm text-white/70">Account balance</p>
        <p class="mt-1 flex items-baseline gap-2">
          <span class="truncate font-display text-3xl font-bold tracking-tight tabular-nums">
            {{ formatMoney(balance, currency) }}
          </span>
          <span class="text-sm font-medium text-white/70">{{ currency }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

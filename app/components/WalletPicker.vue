<script setup lang="ts">
// Header switch for the active wallet (report, plan and history show one wallet at a time); hidden with only one
// wallet. Just the wallet's name and the home card's switch mark, so it reads as "this wallet, tap to change".
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { wallet, pick } = useActiveWallet(wallets);
const open = ref(false);
</script>

<template>
  <template v-if="(wallets?.length ?? 0) > 1">
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-label="`Wallet: ${wallet?.name}. Switch wallet`"
      class="flex h-9 max-w-52 min-w-0 items-center gap-2 rounded-xl bg-muted pr-1.5 pl-3.5 transition-colors active:bg-elevated"
      @click="open = true"
    >
      <span class="min-w-0 truncate text-sm font-semibold text-highlighted">{{ wallet?.name }}</span>
      <!-- Same switch mark as the home wallet card -->
      <span
        aria-hidden="true"
        class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-elevated ring-1 ring-default ring-inset"
      >
        <UIcon name="i-lucide-chevrons-up-down" class="size-3.5 text-toned" />
      </span>
    </button>
    <WalletSelectModal v-model:open="open" :wallets="wallets ?? []" :selected-id="wallet?.id" manage @select="pick" />
  </template>
</template>

<script setup lang="ts">
// Header pill to switch the active wallet (home and plan show one wallet at a time); hidden with only one wallet
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { wallet, pick } = useActiveWallet(wallets);
const open = ref(false);
</script>

<template>
  <template v-if="(wallets?.length ?? 0) > 1">
    <UButton
      :label="wallet?.name"
      icon="i-lucide-wallet"
      trailing-icon="i-lucide-chevron-down"
      color="neutral"
      variant="subtle"
      aria-haspopup="dialog"
      class="max-w-44"
      @click="open = true"
    />
    <WalletSelectModal v-model:open="open" :wallets="wallets ?? []" :selected-id="wallet?.id" manage @select="pick" />
  </template>
</template>

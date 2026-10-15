<script setup lang="ts">
// Header pill to switch the active wallet (home and plan show one wallet at a time); hidden with only one wallet
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { wallet, pick } = useActiveWallet(wallets);

const items = computed(() => [
  (wallets.value ?? []).map((w) => ({
    type: "checkbox" as const,
    label: w.name,
    suffix: w.currency,
    checked: w.id === wallet.value?.id,
    onUpdateChecked: () => pick(w),
  })),
  [{ label: "Manage wallets", icon: "i-lucide-settings-2", to: "/settings" }],
]);
</script>

<template>
  <UDropdownMenu v-if="(wallets?.length ?? 0) > 1" :items="items" :content="{ align: 'start' }">
    <UButton
      :label="wallet?.name"
      icon="i-lucide-wallet"
      trailing-icon="i-lucide-chevron-down"
      color="neutral"
      variant="subtle"
      aria-label="Switch wallet"
      class="max-w-44"
    />
  </UDropdownMenu>
</template>

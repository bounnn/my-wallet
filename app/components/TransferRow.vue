<script setup lang="ts">
// One transfer line in a wallet's list: "To Savings" or "From Cash", the note (or, across currencies, what the
// other wallet got or sent), and the change to the shown wallet. Tapping it emits select (opens the details).
const props = defineProps<{
  transfer: Transfer;
  // The wallet the list is for
  walletId?: number;
  walletById: Map<number, Account>;
  hideCurrency?: boolean;
}>();
defineEmits<{ select: [transfer: Transfer] }>();

const outgoing = computed(() => props.transfer.fromAccountId === props.walletId);
const from = computed(() => props.walletById.get(props.transfer.fromAccountId));
const to = computed(() => props.walletById.get(props.transfer.toAccountId));
const other = computed(() => (outgoing.value ? to.value : from.value));
const currency = computed(() => (outgoing.value ? from.value : to.value)?.currency ?? "USD");
const change = computed(() => transferChange(props.transfer, props.walletId));

// The other side's amount, when it's in another currency
const otherSide = computed(() => {
  if (!props.transfer.rate || !from.value || !to.value) return undefined;
  return outgoing.value
    ? `Received ${formatMoney(props.transfer.toAmount, to.value.currency)}`
    : `Sent ${formatMoney(props.transfer.amount, from.value.currency)}`;
});
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-elevated/60"
      @click="$emit('select', transfer)"
    >
      <IconTile icon="i-lucide-arrow-left-right" color="info" size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-highlighted">
          {{ outgoing ? "To" : "From" }} {{ other?.name ?? "deleted wallet" }}
        </p>
        <p v-if="transfer.note || otherSide" class="truncate text-sm text-muted">{{ transfer.note || otherSide }}</p>
      </div>
      <MoneyAmount
        :amount="change"
        :currency="currency"
        signed
        :hide-currency="hideCurrency"
        align="end"
        class="shrink-0"
        amount-class="font-semibold text-toned"
      />
    </button>
  </li>
</template>

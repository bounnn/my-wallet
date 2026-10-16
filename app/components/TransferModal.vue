<script setup lang="ts">
// Details of one transfer, opened by tapping it in a list: amount sent and received, both wallets, the rate,
// date and note. Edit opens the add screen on it; delete is undone from the toast.
const props = defineProps<{ transfer?: Transfer; walletById: Map<number, Account> }>();
const open = defineModel<boolean>("open", { required: true });

const from = computed(() => props.transfer && props.walletById.get(props.transfer.fromAccountId));
const to = computed(() => props.transfer && props.walletById.get(props.transfer.toAccountId));
const fromCurrency = computed(() => from.value?.currency ?? "USD");
const toCurrency = computed(() => to.value?.currency ?? "USD");

// "Today" / "Yesterday" keep the full date next to them
const dateLabel = computed(() => {
  const date = props.transfer?.date;
  if (!date) return "";
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const label = dayLabel(date);
  return label === formatDate(date) ? `${weekday} ${label}` : `${label}, ${formatDate(date)}`;
});

const toast = useToast();

function edit() {
  if (!props.transfer) return;
  open.value = false;
  navigateTo({ path: "/add", query: { transfer: props.transfer.id } });
}

async function remove() {
  const transfer = props.transfer;
  if (!transfer) return;
  try {
    await deleteTransfer(transfer);
  } catch (error) {
    toast.add({ title: "Can't delete this", description: errorText(error), color: "error", icon: "i-lucide-circle-alert" });
    return;
  }
  open.value = false;
  toast.add({
    title: "Transfer deleted",
    description: formatMoney(transfer.amount, fromCurrency.value),
    icon: "i-lucide-trash-2",
    actions: [{ label: "Undo", color: "neutral", variant: "soft", onClick: () => void restoreTransfer(transfer) }],
  });
}
</script>

<template>
  <UModal v-model:open="open" title="Transfer">
    <template #body>
      <div v-if="transfer">
        <!-- Amount sent first; across currencies, what arrived right under it -->
        <div class="flex flex-col items-center text-center">
          <IconTile icon="i-lucide-arrow-left-right" color="info" />
          <MoneyAmount
            :amount="transfer.amount"
            :currency="fromCurrency"
            class="mt-3"
            amount-class="text-4xl font-bold tracking-tight text-highlighted"
          />
          <p v-if="transfer.rate" class="mt-1 text-sm text-muted">
            Arrived as
            <span class="font-medium text-toned tabular-nums">{{ formatMoney(transfer.toAmount, toCurrency) }}</span>
          </p>
        </div>

        <div class="mt-6 divide-y divide-default rounded-2xl bg-elevated">
          <div class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-arrow-up-right" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">From</span>
            <span class="truncate text-sm font-medium text-highlighted">{{ from?.name ?? "Deleted wallet" }}</span>
          </div>
          <div class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-arrow-down-left" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">To</span>
            <span class="truncate text-sm font-medium text-highlighted">{{ to?.name ?? "Deleted wallet" }}</span>
          </div>
          <div v-if="transfer.rate" class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-repeat" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Rate</span>
            <span class="text-sm font-medium text-highlighted tabular-nums">{{
              formatRate(transfer.rate, fromCurrency, toCurrency)
            }}</span>
          </div>
          <div class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Date</span>
            <span class="text-sm font-medium text-highlighted tabular-nums">{{ dateLabel }}</span>
          </div>
          <div v-if="transfer.note" class="flex items-start gap-3 px-4 py-3">
            <UIcon name="i-lucide-pen-line" class="mt-0.5 size-5 shrink-0 text-dimmed" />
            <p class="min-w-0 flex-1 text-sm break-words whitespace-pre-line text-highlighted">{{ transfer.note }}</p>
          </div>
        </div>

        <div class="mt-6 flex gap-2">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            aria-label="Delete transfer"
            class="size-13 justify-center bg-elevated text-error"
            @click="remove"
          />
          <UButton
            icon="i-lucide-pencil"
            label="Edit"
            size="xl"
            block
            class="h-13 flex-1 justify-center"
            @click="edit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

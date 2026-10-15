<script setup lang="ts">
// Details of one transaction, opened by tapping it in a list: amount, category, date, wallet, note.
// Edit opens the add screen in edit mode; delete is undone from the toast.
const props = defineProps<{ transaction?: Transaction; category?: Category; wallet?: Account; showWallet?: boolean }>();
const open = defineModel<boolean>("open", { required: true });

const currency = computed(() => props.wallet?.currency ?? "USD");
const signed = computed(() =>
  props.transaction ? (props.transaction.type === "income" ? props.transaction.amount : -props.transaction.amount) : 0,
);
// "Today" / "Yesterday" keep the full date next to them
const dateLabel = computed(() => {
  const date = props.transaction?.date;
  if (!date) return "";
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const label = dayLabel(date);
  return label === formatDate(date) ? `${weekday} ${label}` : `${label}, ${formatDate(date)}`;
});

const toast = useToast();

function edit() {
  if (!props.transaction) return;
  open.value = false;
  navigateTo({ path: "/add", query: { id: props.transaction.id } });
}

async function remove() {
  const transaction = props.transaction;
  if (!transaction) return;
  // Money added to a goal can't be removed once it's been taken out again (deleteTransaction says so)
  try {
    await deleteTransaction(transaction);
  } catch (error) {
    toast.add({
      title: "Can't delete this",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
    return;
  }
  open.value = false;
  toast.add({
    title: transaction.type === "income" ? "Income deleted" : "Expense deleted",
    description: formatMoney(transaction.amount, currency.value),
    icon: "i-lucide-trash-2",
    actions: [{ label: "Undo", color: "neutral", variant: "soft", onClick: () => void restoreTransaction(transaction) }],
  });
}
</script>

<template>
  <UModal v-model:open="open" :title="transaction?.type === 'income' ? 'Income' : 'Expense'">
    <template #body>
      <div v-if="transaction">
        <!-- Amount first, category right under it -->
        <div class="flex flex-col items-center text-center">
          <IconTile :icon="category?.icon ?? 'i-lucide-tag'" :color="category?.color" />
          <p class="mt-3 font-medium text-muted">{{ category?.name ?? "Uncategorized" }}</p>
          <MoneyAmount
            :amount="signed"
            :currency="currency"
            signed
            class="mt-1"
            :amount-class="[
              'text-4xl font-bold tracking-tight',
              transaction.type === 'income' ? 'text-success' : 'text-highlighted',
            ].join(' ')"
          />
        </div>

        <div class="mt-6 divide-y divide-default rounded-2xl bg-elevated">
          <div class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Date</span>
            <span class="text-sm font-medium text-highlighted tabular-nums">{{ dateLabel }}</span>
          </div>
          <div v-if="showWallet" class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Wallet</span>
            <span class="truncate text-sm font-medium text-highlighted">{{ wallet?.name }}</span>
          </div>
          <div v-if="transaction.note" class="flex items-start gap-3 px-4 py-3">
            <UIcon name="i-lucide-pen-line" class="mt-0.5 size-5 shrink-0 text-dimmed" />
            <p class="min-w-0 flex-1 text-sm break-words whitespace-pre-line text-highlighted">{{ transaction.note }}</p>
          </div>
        </div>

        <div class="mt-6 flex gap-2">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            :aria-label="transaction.type === 'income' ? 'Delete income' : 'Delete expense'"
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

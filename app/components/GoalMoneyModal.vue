<script setup lang="ts">
// Put money into a goal, or take some out, typed on the in-app keypad. Either way it's a real
// transaction in the goal's category: adding is an expense from a wallet, taking out an income back to it.
const props = defineProps<{ goal?: Goal; category?: Category; saved: number; mode: "add" | "take" }>();
const open = defineModel<boolean>("open", { required: true });

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);

const currency = computed(() => props.goal?.currency ?? "USD");
// Only wallets in the goal's currency can move money in or out
const goalWallets = computed(() => (wallets.value ?? []).filter((w) => w.currency === currency.value));
const accountId = ref<number>();
const wallet = computed(() => goalWallets.value.find((w) => w.id === accountId.value));
const walletItems = computed(() =>
  goalWallets.value.map((w) => ({
    type: "checkbox" as const,
    label: w.name,
    checked: w.id === accountId.value,
    onUpdateChecked: () => (accountId.value = w.id),
  })),
);

const amountText = ref("");
const error = ref<string>();
watch(open, (isOpen) => {
  if (!isOpen) return;
  amountText.value = "";
  error.value = undefined;
  if (!goalWallets.value.some((w) => w.id === accountId.value)) accountId.value = goalWallets.value[0]?.id;
});
watch(amountText, () => (error.value = undefined));

const amount = computed(() => {
  const n = Number.parseFloat(amountText.value);
  return Number.isFinite(n) ? toMinor(n, currency.value) : 0;
});
const left = computed(() => (props.goal ? Math.max(props.goal.target - props.saved, 0) : 0));

const saving = ref(false);
const toast = useToast();

async function save() {
  const goal = props.goal;
  if (!goal) return;
  if (!wallet.value) {
    error.value = `You need a ${currency.value} wallet`;
    return;
  }
  if (amount.value <= 0) {
    error.value = "Enter an amount above 0";
    return;
  }
  if (props.mode === "take" && amount.value > props.saved) {
    error.value = `Only ${formatMoney(props.saved, currency.value)} saved`;
    return;
  }

  saving.value = true;
  try {
    const now = new Date();
    await db.transactions.add({
      accountId: wallet.value.id,
      categoryId: goal.categoryId,
      type: props.mode === "add" ? "expense" : "income",
      amount: amount.value,
      date: now,
      createdAt: now,
    });
    const reached = props.mode === "add" && props.saved < goal.target && props.saved + amount.value >= goal.target;
    toast.add({
      title: reached ? "Goal reached" : props.mode === "add" ? "Money added" : "Money taken out",
      description: `${formatMoney(amount.value, currency.value)} ${props.mode === "add" ? "from" : "to"} ${wallet.value.name}`,
      color: "success",
      icon: reached ? "i-lucide-party-popper" : "i-lucide-circle-check",
    });
    open.value = false;
  } catch (err) {
    toast.add({
      title: "Couldn't save the transaction",
      description: err instanceof Error ? err.message : String(err),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="mode === 'add' ? 'Add money' : 'Take out money'">
    <template #body>
      <div v-if="goal">
        <div class="flex items-center gap-3">
          <IconTile :icon="category?.icon ?? 'i-lucide-piggy-bank'" :color="category?.color" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-highlighted">{{ category?.name }}</p>
            <p class="text-sm text-muted tabular-nums">{{ formatMoney(saved, currency) }} saved</p>
          </div>
        </div>

        <div class="mt-5 divide-y divide-default rounded-2xl bg-elevated">
          <div class="px-4 pt-3 pb-4">
            <div class="flex items-center justify-between">
              <span class="text-sm" :class="error ? 'text-error' : 'text-muted'">{{ error ?? "Amount" }}</span>
              <!-- Quick fill: what's left to reach the target, or everything saved -->
              <button
                v-if="mode === 'add' ? left > 0 : saved > 0"
                type="button"
                class="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-navy-200 transition-colors hover:bg-primary/25"
                @click="amountText = String(fromMinor(mode === 'add' ? left : saved, currency))"
              >
                {{ mode === "add" ? "Fill the rest" : "Take all" }}
              </button>
            </div>
            <p class="mt-1 flex items-baseline gap-1.5 font-display font-bold tracking-tight tabular-nums" aria-live="polite">
              <span class="text-2xl text-dimmed">{{ currencySymbol(currency) }}</span>
              <span class="truncate text-4xl" :class="amountText ? 'text-highlighted' : 'text-dimmed'">
                {{ formatAmountInput(amountText) }}
              </span>
            </p>
          </div>

          <!-- Which wallet the money comes from / goes back to; a menu only when there's a choice -->
          <UDropdownMenu v-if="goalWallets.length > 1" :items="walletItems" :content="{ align: 'end' }">
            <button type="button" class="flex h-12 w-full items-center gap-3 px-4 text-left">
              <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-dimmed" />
              <span class="flex-1 text-sm text-muted">{{ mode === "add" ? "From" : "To" }}</span>
              <span class="truncate text-sm font-medium text-highlighted">{{ wallet?.name }}</span>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
            </button>
          </UDropdownMenu>
        </div>

        <AmountKeypad v-model="amountText" :decimals="currencyDigits(currency)" class="mt-3" />

        <UButton
          :label="mode === 'add' ? 'Add to goal' : 'Take out'"
          size="xl"
          block
          :loading="saving"
          class="mt-3 h-13 justify-center"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>

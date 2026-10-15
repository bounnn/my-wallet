<script setup lang="ts">
// Put money into a goal, or take some out, typed on the in-app keypad. Either way it's a real
// transaction in the goal's category: adding is an expense from the goal's wallet, taking out an income back to it.
const props = defineProps<{ goal?: Goal; category?: Category; saved: number; mode: "add" | "take" }>();
const open = defineModel<boolean>("open", { required: true });

// All wallets live, then the goal's one picked reactively (a live query reading props.goal wouldn't re-run
// when the modal opens for another goal, so it stayed empty and saving said the wallet was deleted)
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const wallet = computed(() => wallets.value?.find((w) => w.id === props.goal?.accountId));

const currency = computed(() => props.goal?.currency ?? "USD");

const amountText = ref("");
const error = ref<string>();
// Set once this payment reaches the target; the body then shows the celebration
const celebration = ref<{ name: string; target: number }>();
watch(open, (isOpen) => {
  if (!isOpen) return;
  amountText.value = "";
  error.value = undefined;
  celebration.value = undefined;
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
    error.value = "This goal's wallet was deleted";
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
    // Reaching a goal is the big moment: the modal turns into a celebration instead of closing with a toast
    if (reached) {
      celebration.value = { name: props.category?.name ?? "your goal", target: goal.target };
      return;
    }
    toast.add({
      title: props.mode === "add" ? "Money added" : "Money taken out",
      description: `${formatMoney(amount.value, currency.value)} ${props.mode === "add" ? "from" : "to"} ${wallet.value.name}`,
      color: "success",
      icon: "i-lucide-circle-check",
    });
    open.value = false;
  } catch (err) {
    toast.add({
      title: "Couldn't save the transaction",
      description: errorText(err),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="celebration ? 'Goal reached' : mode === 'add' ? 'Add money' : 'Take out money'">
    <template #body>
      <!-- Goal reached: a spark coin lands in a soft navy glow, like the card at the end of onboarding -->
      <div v-if="celebration" class="flex flex-col items-center pt-4 text-center">
        <div class="relative flex size-40 items-center justify-center" aria-hidden="true">
          <div class="absolute size-36 rounded-full bg-navy-600/35 blur-2xl" />
          <div class="coin-land metal-coin relative flex size-24 items-center justify-center rounded-full">
            <SparkGlyph class="size-12" />
          </div>
        </div>
        <span class="mt-4 inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <UIcon name="i-lucide-check" class="size-3.5" /> {{ formatAmount(celebration.target, currency) }} {{ currency }} saved
        </span>
        <p class="mt-3 font-display text-[1.75rem] leading-tight font-bold tracking-tight text-highlighted">
          You did it.
        </p>
        <p class="mt-2 text-muted">{{ celebration.name }} is fully saved. Well done.</p>
        <UButton label="Done" size="xl" block class="mt-8 h-13 justify-center" @click="open = false" />
      </div>

      <div v-else-if="goal">
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
                class="-my-2 h-10 rounded-full bg-primary/20 px-3.5 text-sm font-medium text-navy-100 transition-colors hover:bg-primary/25"
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

<style scoped>
/* The coin drops in and settles (no overshoot) */
.coin-land {
  animation: coin-land 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes coin-land {
  from {
    opacity: 0;
    transform: translateY(-48px) scale(0.8) rotate(-20deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .coin-land {
    animation: none;
  }
}
</style>

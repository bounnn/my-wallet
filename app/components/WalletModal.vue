<script setup lang="ts">
import * as v from "valibot";

// Create a wallet, or edit / delete one when `wallet` is given: name, currency, starting balance.
// The currency is locked once the wallet has transactions, goals or budgets (their amounts are stored in its minor units).
const props = defineProps<{ wallet?: Account; canDelete?: boolean }>();
const open = defineModel<boolean>("open", { required: true });

const { value: counts } = useLiveQuery(
  async () => {
    const id = props.wallet?.id;
    if (id === undefined) return { transactions: 0, goals: 0, budgets: 0 };
    const [transactions, goals, budgets] = await Promise.all([
      db.transactions.where("accountId").equals(id).count(),
      db.goals.where("accountId").equals(id).count(),
      db.budgets.where("accountId").equals(id).count(),
    ]);
    return { transactions, goals, budgets };
  },
  { transactions: 0, goals: 0, budgets: 0 },
);
const currencyLocked = computed(() => Object.values(counts.value ?? {}).some((n) => n > 0));

const currencyItems = currencyOptions().map((c) => ({ label: c.code, value: c.code, description: c.name }));

const name = ref("");
const currency = ref("USD");
const balanceText = ref("");
const errors = ref<{ name?: string; balance?: string }>({});

// Fill the form each time it opens: the wallet's values, or a blank one in the main wallet's currency
watch(open, async (isOpen) => {
  if (!isOpen) return;
  const w = props.wallet;
  name.value = w?.name ?? "";
  currency.value = w?.currency ?? (await db.accounts.orderBy("id").first())?.currency ?? "USD";
  balanceText.value = w?.initialBalance ? formatAmount(w.initialBalance, w.currency) : "";
  errors.value = {};
});

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Give the wallet a name"),
    v.maxLength(50, "Keep it under 50 characters"),
  ),
  // Empty means a zero starting balance
  balance: v.pipe(v.number(), v.check(Number.isFinite, "Enter a number")),
});

const saving = ref(false);
const toast = useToast();

async function save() {
  const result = v.safeParse(schema, {
    name: name.value,
    balance: balanceText.value.trim() ? parseAmount(balanceText.value, currency.value) : 0,
  });
  if (!result.success) {
    const nested = v.flatten<typeof schema>(result.issues).nested ?? {};
    errors.value = { name: nested.name?.[0], balance: nested.balance?.[0] };
    return;
  }

  const fields = { name: result.output.name, currency: currency.value, initialBalance: result.output.balance };
  saving.value = true;
  try {
    if (props.wallet) await db.accounts.update(props.wallet.id, fields);
    else await db.accounts.add({ ...fields, createdAt: new Date() });
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the wallet",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}

// Deleting takes the wallet's transactions, goals and budgets with it, so it asks first
const confirmOpen = ref(false);
const deleting = ref(false);
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const deleteDescription = computed(() => {
  const c = counts.value ?? { transactions: 0, goals: 0, budgets: 0 };
  const parts = [
    c.transactions && plural(c.transactions, "transaction"),
    c.goals && plural(c.goals, "goal"),
    c.budgets && plural(c.budgets, "budget"),
  ].filter(Boolean);
  return parts.length
    ? `${props.wallet?.name} and its ${parts.join(", ")} will be gone for good.`
    : `${props.wallet?.name} will be gone for good.`;
});

async function remove() {
  const wallet = props.wallet;
  if (!wallet) return;
  deleting.value = true;
  try {
    await db.transaction("rw", [db.accounts, db.transactions, db.goals, db.budgets, db.categories], async () => {
      // Goals' categories are archived like a deleted goal's, so nothing else loses a name
      const goals = await db.goals.where("accountId").equals(wallet.id).toArray();
      await db.categories.bulkUpdate(goals.map((g) => ({ key: g.categoryId, changes: { archived: true } })));
      await db.goals.bulkDelete(goals.map((g) => g.id));
      await db.budgets.where("accountId").equals(wallet.id).delete();
      await db.transactions.where("accountId").equals(wallet.id).delete();
      await db.accounts.delete(wallet.id);
    });
    confirmOpen.value = false;
    open.value = false;
    toast.add({ title: "Wallet deleted", description: wallet.name, icon: "i-lucide-trash-2" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="wallet ? 'Edit wallet' : 'New wallet'">
    <template #body>
      <form class="space-y-5" @submit.prevent="save">
        <!-- Grouped card like the add screen: name, currency, then the starting balance -->
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <label class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-dimmed" />
            <span class="min-w-0 flex-1">
              <span class="block text-xs" :class="errors.name ? 'text-error' : 'text-muted'">{{ errors.name ?? "Name" }}</span>
              <input
                v-model="name"
                placeholder="e.g. Savings"
                maxlength="50"
                autocomplete="off"
                enterkeyhint="done"
                aria-label="Wallet name"
                :aria-invalid="!!errors.name"
                class="w-full truncate bg-transparent font-medium text-highlighted caret-primary outline-none placeholder:text-dimmed"
                @input="errors.name = undefined"
              />
            </span>
          </label>

          <div class="flex min-h-12 items-center gap-3 px-4 py-2">
            <UIcon name="i-lucide-coins" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Currency</span>
            <span
              v-if="currencyLocked"
              class="rounded-md bg-accented px-2 py-0.5 text-xs font-medium text-toned"
            >{{ currency }}</span>
            <USelectMenu
              v-else
              v-model="currency"
              :items="currencyItems"
              value-key="value"
              :filter-fields="['label', 'description']"
              :search-input="{ placeholder: 'Search currency' }"
              :content="{ align: 'end' }"
              aria-label="Currency"
              class="w-28"
            />
          </div>

          <AmountField
            v-model="balanceText"
            label="Starting balance"
            :currency="currency"
            :error="errors.balance"
            @update:model-value="errors.balance = undefined"
          />
        </div>
        <p v-if="currencyLocked" class="-mt-2 text-sm text-dimmed">
          The currency can't change once a wallet has transactions, goals or budgets.
        </p>

        <div class="flex gap-2">
          <UButton
            v-if="wallet && canDelete"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            aria-label="Delete wallet"
            class="size-13 justify-center bg-elevated text-error"
            @click="confirmOpen = true"
          />
          <UButton
            type="submit"
            :label="wallet ? 'Save wallet' : 'Add wallet'"
            size="xl"
            block
            :loading="saving"
            class="h-13 flex-1 justify-center"
          />
        </div>
      </form>
    </template>
  </UModal>

  <ConfirmModal
    v-model:open="confirmOpen"
    title="Delete wallet?"
    :description="deleteDescription"
    confirm-label="Delete"
    :loading="deleting"
    @confirm="remove"
  />
</template>

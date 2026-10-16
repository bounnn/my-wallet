<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

// Create a wallet, or edit / delete one when `wallet` is given: name, currency, starting balance.
// The currency is locked once the wallet has transactions, goals or budgets (their amounts are stored in its minor units).
const props = defineProps<{ wallet?: Account; canDelete?: boolean }>();
const open = defineModel<boolean>("open", { required: true });

const noUsage = { transactions: 0, transfers: 0, goals: 0, budgets: 0 };
const { value: usage } = useLiveQuery(
  () => (props.wallet ? walletUsage(props.wallet.id) : noUsage),
  noUsage,
  () => props.wallet?.id,
);
const currencyLocked = computed(() => Object.values(usage.value ?? noUsage).some((n) => n > 0));

const currencyItems = currencyOptions().map((c) => ({ label: c.code, value: c.code, description: c.name }));

const state = reactive({ name: "", currency: "USD", balance: "" });

// Fill the form each time it opens: the wallet's values, or a blank one in the main wallet's currency
watch(open, async (isOpen) => {
  if (!isOpen) return;
  const w = props.wallet;
  state.name = w?.name ?? "";
  state.currency = w?.currency ?? (await mainCurrency()) ?? "USD";
  state.balance = w?.initialBalance ? formatAmount(w.initialBalance, w.currency) : "";
});

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Give the wallet a name"),
    v.maxLength(50, "Keep it under 50 characters"),
  ),
  currency: v.string(),
  // Empty means a zero starting balance
  balance: v.pipe(
    v.string(),
    v.transform((text) => (text.trim() ? parseAmount(text, state.currency) : 0)),
    v.check((n: number) => Number.isFinite(n), "Enter a number"),
  ),
});

const toast = useToast();

async function save({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  const fields = { name: data.name, currency: data.currency, initialBalance: data.balance };
  try {
    if (props.wallet) await updateWallet(props.wallet.id, fields);
    else await addWallet(fields);
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the wallet",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}

// Deleting takes the wallet's transactions, goals and budgets with it, so it asks first
const confirmOpen = ref(false);
const deleting = ref(false);
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const deleteDescription = computed(() => {
  const u = usage.value ?? noUsage;
  const parts = [
    u.transactions && plural(u.transactions, "transaction"),
    u.transfers && plural(u.transfers, "transfer"),
    u.goals && plural(u.goals, "goal"),
    u.budgets && plural(u.budgets, "budget"),
  ].filter(Boolean);
  const gone = parts.length
    ? `${props.wallet?.name} and its ${parts.join(", ")} will be gone for good.`
    : `${props.wallet?.name} will be gone for good.`;
  // A transfer's other side goes too, which changes the other wallet's balance
  return u.transfers ? `${gone} The other wallets' balances change by those transfers.` : gone;
});

async function remove() {
  const wallet = props.wallet;
  if (!wallet) return;
  deleting.value = true;
  try {
    await deleteWallet(wallet.id);
    confirmOpen.value = false;
    open.value = false;
    toast.add({ title: "Wallet deleted", description: wallet.name, icon: "i-lucide-trash-2" });
  } catch (error) {
    toast.add({
      title: "Couldn't delete the wallet",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="wallet ? 'Edit wallet' : 'New wallet'">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-5" @submit="save">
        <!-- Grouped card like the add screen: name, currency, then the starting balance -->
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <FieldRow
            v-model="state.name"
            name="name"
            label="Name"
            icon="i-lucide-wallet"
            placeholder="e.g. Savings"
            :maxlength="50"
          />

          <div class="flex min-h-12 items-center gap-3 px-4 py-2">
            <UIcon name="i-lucide-coins" class="size-5 shrink-0 text-dimmed" />
            <span class="flex-1 text-sm text-muted">Currency</span>
            <span
              v-if="currencyLocked"
              class="rounded-md bg-accented px-1.5 py-0.5 text-xs font-medium text-toned"
            >{{ state.currency }}</span>
            <USelectMenu
              v-else
              v-model="state.currency"
              :items="currencyItems"
              value-key="value"
              :filter-fields="['label', 'description']"
              :search-input="{ placeholder: 'Search currency' }"
              :content="{ align: 'end' }"
              aria-label="Currency"
              class="w-28"
            />
          </div>

          <AmountField v-model="state.balance" name="balance" label="Starting balance" :currency="state.currency" />
        </div>
        <p v-if="currencyLocked" class="-mt-2 text-sm text-muted">
          The currency can't change once a wallet has transactions, transfers, goals or budgets.
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
            loading-auto
            class="h-13 flex-1 justify-center"
          />
        </div>
      </UForm>
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

<script setup lang="ts">
import { today, getLocalTimeZone } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

// Edit one scanned payment before it's saved: wallet, amount, category (with the AI's other guesses a tap
// away), date and note. Works on a copy; Done hands it back.
const props = defineProps<{ draft?: ScanDraft; wallets: Account[] }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ save: [draft: ScanDraft] }>();

const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// The form's copy, refilled each time the modal opens. The day stays out of the reactive state: a
// CalendarDate has private fields, which break inside a reactive proxy.
const state = reactive({
  accountId: undefined as number | undefined,
  amountText: "",
  categoryId: undefined as number | undefined,
  note: "",
});
const day = shallowRef(today(getLocalTimeZone()));
watch(open, (isOpen) => {
  if (!isOpen || !props.draft) return;
  const { accountId, amountText, categoryId, note } = props.draft;
  Object.assign(state, { accountId, amountText, categoryId, note });
  day.value = props.draft.day;
});

const wallet = computed(() => props.wallets.find((w) => w.id === state.accountId));
const currency = computed(() => wallet.value?.currency ?? "USD");
// Amounts aren't converted, so a bill in another currency is pointed out
const otherCurrency = computed(() =>
  props.draft?.billCurrency && wallet.value && props.draft.billCurrency !== wallet.value.currency
    ? props.draft.billCurrency
    : undefined,
);
// A wallet with a different number of decimals reads the typed amount anew
function pickWallet(w: Account) {
  state.accountId = w.id;
  state.amountText = groupAmountInput(state.amountText, w.currency);
}

const category = computed(() => categories.value?.find((c) => c.id === state.categoryId));
const suggestionCategories = computed(() =>
  (props.draft?.suggestions ?? []).flatMap((id) => categories.value?.find((c) => c.id === id) ?? []),
);

const categoryOpen = ref(false);
const walletOpen = ref(false);

const schema = v.object({
  accountId: v.number("Pick a wallet"),
  amountText: v.pipe(
    v.string(),
    v.check((text) => parseAmount(text, currency.value) > 0, "Enter an amount above 0"),
  ),
  categoryId: v.number("Pick a category"),
  note: v.pipe(v.string(), v.trim(), v.maxLength(100, "Keep the note under 100 characters")),
});

// The category and wallet pickers aren't form inputs, so a pick clears their error by hand
const form = useTemplateRef("form");
watch(() => state.categoryId, () => form.value?.clear("categoryId"));

function done({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  if (!props.draft) return;
  emit("save", { ...props.draft, ...data, day: day.value, include: true });
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" title="Edit payment">
    <template #body>
      <UForm v-if="draft" ref="form" :schema="schema" :state="state" @submit="done">
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <AmountField v-model="state.amountText" name="amountText" label="Amount" :currency="currency" />

          <!-- Category, with the AI's guesses under it -->
          <UFormField name="categoryId" :ui="{ error: 'sr-only' }">
            <template #default="{ error }">
              <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" @click="categoryOpen = true">
                <IconTile v-if="category" :icon="category.icon ?? 'i-lucide-tag'" :color="category.color" size="sm" />
                <span
                  v-else
                  class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-dashed"
                  :class="error ? 'border-error text-error' : 'border-accented text-dimmed'"
                >
                  <UIcon name="i-lucide-shapes" class="size-5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs" :class="error ? 'text-error' : 'text-muted'">{{ error || "Category" }}</span>
                  <span class="block truncate font-medium" :class="category ? 'text-highlighted' : 'text-dimmed'">
                    {{ category?.name ?? "Select category" }}
                  </span>
                </span>
                <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
              </button>
              <div v-if="suggestionCategories.length > 1" class="flex flex-wrap items-center gap-2 px-4 pb-3">
                <UIcon name="i-lucide-sparkles" class="size-4 shrink-0 text-muted" aria-label="Suggested" />
                <button
                  v-for="c in suggestionCategories"
                  :key="c.id"
                  type="button"
                  :aria-pressed="c.id === state.categoryId"
                  class="flex h-9 min-w-0 items-center gap-1.5 rounded-lg pr-2.5 pl-1 text-xs font-medium transition-colors"
                  :class="c.id === state.categoryId ? 'bg-accented text-highlighted ring-1 ring-primary' : 'bg-accented/60 text-muted'"
                  @click="state.categoryId = c.id"
                >
                  <IconTile :icon="c.icon ?? 'i-lucide-tag'" :color="c.color" size="xs" />
                  <span class="truncate">{{ c.name }}</span>
                </button>
              </div>
            </template>
          </UFormField>

          <!-- Wallet: where it's saved; warns when the bill is in another currency -->
          <div>
            <button type="button" class="flex h-12 w-full items-center gap-3 px-4 text-left" @click="walletOpen = true">
              <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-dimmed" />
              <span class="flex-1 text-sm text-muted">Wallet</span>
              <span class="truncate text-sm font-medium text-highlighted">{{ wallet?.name ?? "Pick a wallet" }}</span>
              <span v-if="wallet" class="shrink-0 rounded-md bg-accented px-1.5 py-0.5 text-xs font-medium text-toned">
                {{ wallet.currency }}
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
            </button>
            <p v-if="otherCurrency" class="flex gap-2 px-4 pb-3 text-xs text-warning">
              <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
              The bill is in {{ otherCurrency }}. The amount is saved as typed, not converted.
            </p>
          </div>

          <DayPicker v-model="day" />

          <FieldRow v-model="state.note" name="note" label="Note" placeholder="Add a note" :maxlength="100" />
        </div>

        <UButton type="submit" label="Done" size="xl" block class="mt-3 h-13 justify-center" />
      </UForm>

      <CategoryModal
        v-model:open="categoryOpen"
        :type="draft?.type ?? 'expense'"
        :account-id="state.accountId"
        :selected-id="state.categoryId"
        @select="state.categoryId = $event"
      />
      <WalletSelectModal v-model:open="walletOpen" :wallets="wallets" :selected-id="state.accountId" @select="pickWallet" />
    </template>
  </UModal>
</template>

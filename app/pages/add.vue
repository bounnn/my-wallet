<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

definePageMeta({ layout: false });

// /add?id=12 edits that transaction instead of adding a new one, /add?transfer=3 that transfer.
// /add?type=income (or expense, transfer) starts on that type: the buttons under home's card.
const query = useRoute().query;
const editId = Number(query.id) || undefined;
const editTransferId = Number(query.transfer) || undefined;
const isEdit = editId !== undefined || editTransferId !== undefined;
const startType = (["expense", "income", "transfer"] as const).find((t) => t === query.type) ?? "expense";
useHead({ title: editTransferId ? "Edit transfer" : editId ? "Edit transaction" : "Add transaction" });

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);

// --- Type: expense / income, or a transfer between two wallets (offered with 2+ wallets). An edit
// can switch expense / income but not turn a transaction into a transfer or back. ---
type Mode = Transaction["type"] | "transfer";
const type = ref<Mode>(isEdit ? "expense" : startType);
const types = computed(() => [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  ...(!isEdit && (wallets.value?.length ?? 0) > 1 ? [{ label: "Transfer", value: "transfer" }] : []),
]);

// --- Wallet: defaults to the one home shows; only shown when there is a choice ---
const { wallet: activeWallet } = useActiveWallet(wallets);
const accountId = ref<number>();
watch(
  activeWallet,
  (w) => {
    if (accountId.value === undefined) accountId.value = w?.id;
  },
  { immediate: true },
);
const wallet = computed(() =>
  wallets.value?.find((w) => w.id === accountId.value),
);
const currency = computed(() => wallet.value?.currency ?? "USD");
// The amount was typed for the old currency's decimals, so a different currency starts it over.
// Another wallet's goal can't be picked, so its category is cleared too.
function pickWallet(w: Account) {
  if (w.currency !== currency.value) amountText.value = "";
  const pickedGoal = goals.value?.find((g) => g.categoryId === categoryId.value);
  if (pickedGoal && pickedGoal.accountId !== w.id) categoryId.value = undefined;
  accountId.value = w.id;
}
// Editing a goal's money keeps it in the goal's wallet, the only one it counts
const walletChoices = computed(() =>
  (wallets.value ?? []).filter((w) => !goal.value || w.id === goal.value.accountId),
);
const walletOpen = ref(false);
// The wallet modal picks the transaction's wallet, or a transfer's sending or receiving one
const walletTarget = ref<"from" | "to">("from");
function openWalletPicker(target: "from" | "to") {
  walletTarget.value = target;
  walletOpen.value = true;
}

// --- Transfer: money leaves the wallet above (accountId) and lands in toAccountId ---
const toAccountId = ref<number>();
const toWallet = computed(() => wallets.value?.find((w) => w.id === toAccountId.value));
const toCurrency = computed(() => toWallet.value?.currency ?? currency.value);
const sameCurrency = computed(() => toCurrency.value === currency.value);
// Picking the other side's wallet swaps the two, so they never match
function pickFrom(w: Account) {
  if (w.id === toAccountId.value) toAccountId.value = accountId.value;
  pickWallet(w);
  prefillRate();
}
function pickTo(w: Account) {
  if (w.id === accountId.value && toWallet.value) pickWallet(toWallet.value);
  toAccountId.value = w.id;
  prefillRate();
}
// The typed rate is turned round with the wallets, so it still holds
function swapWallets() {
  const from = wallet.value;
  const to = toWallet.value;
  if (!from || !to) return;
  const current = rate.value;
  pickWallet(to);
  toAccountId.value = from.id;
  if (Number.isFinite(current)) setRate(1 / current);
}
// Starts on another wallet than the sending one
function defaultToWallet() {
  if (toAccountId.value === undefined || toAccountId.value === accountId.value) {
    toAccountId.value = wallets.value?.find((w) => w.id !== accountId.value)?.id;
  }
}

// Exchange rate, needed when the currencies differ. Typed as "1 USD = 21,500 LAK", or turned round
// ("1 LAK = 0.000047 USD" is hard to type), whichever reads better.
const rateText = ref("");
const rateFlipped = ref(false);
const rateBase = computed(() => (rateFlipped.value ? toCurrency.value : currency.value));
const rateQuote = computed(() => (rateFlipped.value ? currency.value : toCurrency.value));
// Sending → receiving currency, NaN until a rate above 0 is typed
const rate = computed(() => {
  const n = parseNumberInput(rateText.value);
  return n > 0 ? (rateFlipped.value ? 1 / n : n) : Number.NaN;
});
const rateInputText = (n: number) => groupNumberInput(String(Number(n.toFixed(rateDigits))), rateDigits);
// Shows a rate (sending → receiving) the way round that gives a number of 1 or more
function setRate(value: number | undefined) {
  if (!value) {
    rateText.value = "";
    return;
  }
  rateFlipped.value = value < 1;
  rateText.value = rateInputText(rateFlipped.value ? 1 / value : value);
}
function flipRate() {
  const current = rate.value;
  rateFlipped.value = !rateFlipped.value;
  if (Number.isFinite(current)) rateText.value = rateInputText(rateFlipped.value ? 1 / current : current);
}
// Starts with the rate used last between the two currencies
async function prefillRate() {
  if (sameCurrency.value) return;
  setRate(await lastRate(currency.value, toCurrency.value));
}
const rateInput = useTemplateRef("rateInput");
function onRateUpdate(value: string | number | null | undefined) {
  const grouped = groupNumberInput(String(value ?? ""), rateDigits);
  rateText.value = grouped;
  const el = rateInput.value?.inputRef;
  if (el && el.value !== grouped) el.value = grouped;
}
// What arrives, once both the amount and the rate are there
const received = computed(() => {
  const n = Number.parseFloat(amountText.value);
  if (hasOperator(amountText.value) || !(n > 0) || !Number.isFinite(rate.value)) return undefined;
  return convertAmount(toMinor(n, currency.value), rate.value, currency.value, toCurrency.value);
});

// --- Amount: a number, or a calculator expression like "12+3×2" that only becomes
// the amount once = is pressed (the keypad then replaces it with the result) ---
const amountText = ref("");
const digits = computed(() => currencyDigits(currency.value));

// --- Category: picked in a modal ---
const categoryId = ref<number>();
const categoryOpen = ref(false);
const category = computed(() =>
  categories.value?.find((c) => c.id === categoryId.value),
);
// Categories are per type, so switching type clears the pick. A transfer gets its receiving wallet
// and the last rate.
function setType(value: Mode) {
  if (value !== type.value) categoryId.value = undefined;
  type.value = value;
  if (value === "transfer") {
    defaultToWallet();
    if (!rateText.value) prefillRate();
  }
}

// --- Date: today by default (DayPicker), or ?date=2026-10-14 (from a day on home's calendar); never a future day ---
const now = new Date();
const today = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
function queryDay() {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(query.date ?? ""));
  if (!match) return undefined;
  const day = new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return day.compare(today) <= 0 ? day : undefined;
}
const pickedDay = shallowRef(queryDay() ?? today);

// --- Note (and a transfer's rate): typing it swaps the keypad for the phone keyboard ---
const note = ref("");
const focusedField = ref<"note" | "rate">();
let keypadTimer: ReturnType<typeof setTimeout> | undefined;

function onFieldFocus(field: "note" | "rate") {
  clearTimeout(keypadTimer);
  focusedField.value = field;
}
// Bring the keypad back a moment later, so a tap on Save isn't shifted by the layout change
function onFieldBlur() {
  keypadTimer = setTimeout(() => (focusedField.value = undefined), 150);
}
const closeKeyboard = () => (document.activeElement as HTMLElement | null)?.blur();

// The keypad can be slid down to see the whole form; tapping the amount brings it back
const keypadOpen = ref(true);
const showKeypad = computed(() => keypadOpen.value && !focusedField.value);
function openKeypad() {
  closeKeyboard();
  keypadOpen.value = true;
}

// Keep the screen (and its Save button) above the on-screen keyboard
const viewport = useVisualViewport();

// --- Scan: up to 5 bill photos or bank screenshots are read on the review screen, which replaces this one ---
const scanInput = useTemplateRef("scanInput");
function pickScan(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  // Lets the same images be picked again
  input.value = "";
  if (!files.length) return;
  // The phone's picker can't be limited, so extra images are left out
  if (files.length > maxScanImages) {
    toast.add({
      title: `Only the first ${maxScanImages} images are read`,
      description: `${files.length - maxScanImages} left out. Scan them next.`,
      color: "warning",
      icon: "i-lucide-images",
    });
  }
  pendingScan.value = files.slice(0, maxScanImages);
  navigateTo("/scan", { replace: true });
}

// Opened on Transfer: once the wallets are loaded, pick the receiving one and the last rate
// (or fall back to an expense when there's no second wallet)
if (!isEdit && startType === "transfer") {
  const stop = watch(accountId, (id) => {
    if (id === undefined) return;
    stop();
    setType((wallets.value?.length ?? 0) > 1 ? "transfer" : "expense");
  });
}

// --- Edit: fill the form from the saved transaction; a missing one (deleted meanwhile) goes home ---
const editing = shallowRef<Transaction>();
const editingTransfer = shallowRef<Transfer>();
// Money added to / taken out of a goal: type and category stay the goal's, so it keeps counting there
const goal = shallowRef<Goal>();
onMounted(async () => {
  if (editTransferId !== undefined) {
    const t = await db.transfers.get(editTransferId);
    if (!t) return navigateTo("/", { replace: true });
    const from = await db.accounts.get(t.fromAccountId);
    editingTransfer.value = t;
    type.value = "transfer";
    accountId.value = t.fromAccountId;
    toAccountId.value = t.toAccountId;
    amountText.value = String(fromMinor(t.amount, from?.currency ?? currency.value));
    setRate(t.rate);
    pickedDay.value = new CalendarDate(t.date.getFullYear(), t.date.getMonth() + 1, t.date.getDate());
    note.value = t.note ?? "";
    keypadOpen.value = false;
    return;
  }
  if (editId === undefined) return;
  const t = await db.transactions.get(editId);
  if (!t) return navigateTo("/", { replace: true });
  const w = await db.accounts.get(t.accountId);
  editing.value = t;
  goal.value = await goalByCategory(t.categoryId);
  type.value = t.type;
  accountId.value = t.accountId;
  categoryId.value = t.categoryId;
  amountText.value = String(fromMinor(t.amount, w?.currency ?? currency.value));
  pickedDay.value = new CalendarDate(t.date.getFullYear(), t.date.getMonth() + 1, t.date.getDate());
  note.value = t.note ?? "";
  // The amount is already there, so show the whole form rather than the keypad
  keypadOpen.value = false;
});

// --- Save ---
// The form's state is the refs above (reactive unwraps them, so the form reads and writes the same values)
const state = reactive({ amount: amountText, categoryId, accountId, toAccountId, rate: rateText, note });
const amountSchema = v.pipe(
  v.string(),
  // An unfinished sum isn't an amount yet
  v.check(
    (text) => !hasOperator(text),
    ({ input }) => {
      const total = evaluateExpression(String(input));
      return Number.isFinite(total) && total > 0
        ? "Press = to get the total"
        : "This sum doesn't give an amount above 0";
    },
  ),
  v.transform((text) => {
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? toMinor(n, currency.value) : 0;
  }),
  v.minValue(1, "Enter an amount above 0"),
);
const noteSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(100, "Keep the note under 100 characters"),
);
const schema = v.object({
  amount: amountSchema,
  categoryId: v.number("Pick a category"),
  accountId: v.number("Pick a wallet"),
  note: noteSchema,
});
const transferSchema = v.object({
  amount: amountSchema,
  accountId: v.number("Pick a wallet"),
  toAccountId: v.number("Pick a wallet"),
  // Sending → receiving currency; none between wallets in one currency
  rate: v.pipe(
    v.string(),
    v.transform(() => (sameCurrency.value ? undefined : rate.value)),
    v.check((r) => r === undefined || Number.isFinite(r), "Enter the exchange rate"),
  ),
  note: noteSchema,
});
const formSchema = computed(() => (type.value === "transfer" ? transferSchema : schema));

// The keypad and the category / wallet pickers aren't form inputs, so a change clears their error by hand
const form = useTemplateRef("form");
watch(amountText, () => form.value?.clear("amount"));
watch(categoryId, () => form.value?.clear("categoryId"));
watch(rateText, () => form.value?.clear("rate"));

const toast = useToast();

// "Add & new" saves and stays for the next one: type, wallet and date are kept (entries in a row are often
// from the same day), the rest starts over with the keypad up
const addAnother = ref(false);
async function startNext() {
  amountText.value = "";
  categoryId.value = undefined;
  note.value = "";
  keypadOpen.value = true;
  // After the watchers above ran, so the cleared fields don't show "required" errors
  await nextTick();
  form.value?.clear();
}

type TransactionData = v.InferOutput<typeof schema>;
type TransferData = v.InferOutput<typeof transferSchema>;

async function save({ data }: FormSubmitEvent<TransactionData | TransferData>) {
  // The picked day at the current time, so same-day entries keep their order.
  // An edit keeps its own time.
  const time = (editing.value ?? editingTransfer.value)?.date ?? new Date();
  const day = pickedDay.value.toDate(getLocalTimeZone());
  const date = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
  );

  if (type.value === "transfer") return finishTransfer(data as TransferData, date);
  const fields = data as TransactionData;
  try {
    await saveTransaction(
      { ...fields, type: type.value, note: fields.note || undefined, date },
      editing.value?.id,
    );
  } catch (err) {
    // A goal's saved amount can't go below 0; that's about the amount, so it shows there
    if (err instanceof UserError) {
      form.value?.setErrors([{ name: "amount", message: err.message }], "amount");
      return;
    }
    toast.add({
      title: "Couldn't save the transaction",
      description: errorText(err),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
    return;
  }
  toast.add({
    title: editing.value ? "Changes saved" : type.value === "income" ? "Income added" : "Expense added",
    description: formatMoney(data.amount, currency.value),
    color: "success",
    icon: "i-lucide-circle-check",
  });
  if (addAnother.value) startNext();
  else close();
}

async function finishTransfer(data: TransferData, date: Date) {
  try {
    await saveTransfer(
      {
        fromAccountId: data.accountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        rate: data.rate,
        note: data.note || undefined,
        date,
      },
      editingTransfer.value?.id,
    );
  } catch (err) {
    toast.add({
      title: "Couldn't save the transfer",
      description: errorText(err),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
    return;
  }
  const sent = formatMoney(data.amount, currency.value);
  toast.add({
    title: editingTransfer.value ? "Changes saved" : "Transfer added",
    description: data.rate
      ? `${sent} → ${formatMoney(convertAmount(data.amount, data.rate, currency.value, toCurrency.value), toCurrency.value)}`
      : sent,
    color: "success",
    icon: "i-lucide-circle-check",
  });
  if (addAnother.value) startNext();
  else close();
}

// Go back when the screen was opened from inside the app, otherwise home (e.g. after a reload)
function close() {
  if (window.history.state?.back) useRouter().back();
  else navigateTo("/", { replace: true });
}
</script>

<template>
  <div
    class="flex h-dvh flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)]"
    :style="
      viewport.height.value
        ? {
            height: `${viewport.height.value}px`,
            transform: `translateY(${viewport.offsetTop.value}px)`,
          }
        : undefined
    "
  >
    <!-- Top bar: back + title, then the expense / income / transfer switch (one tap, no menu) on its own
         row, since three choices don't fit next to the title -->
    <header class="flex h-14 shrink-0 items-center gap-2 px-4">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        class="-ml-2"
        @click="close"
      />
      <h1
        class="flex-1 truncate font-display text-lg font-semibold tracking-tight text-highlighted"
      >
        {{
          editTransferId
            ? "Edit transfer"
            : editId
              ? type === "income"
                ? "Edit income"
                : "Edit expense"
              : "Add new"
        }}
      </h1>
      <template v-if="!isEdit && type !== 'transfer'">
        <UButton
          icon="i-lucide-scan-text"
          color="neutral"
          variant="ghost"
          aria-label="Scan bills or screenshots, up to 5"
          @click="scanInput?.click()"
        />
        <input ref="scanInput" type="file" accept="image/*" multiple class="hidden" @change="pickScan" />
      </template>
      <span
        v-if="goal"
        class="shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned"
      >
        {{ type === "expense" ? "Added to goal" : "Taken out of goal" }}
      </span>
    </header>
    <div v-if="!goal && !editTransferId" class="shrink-0 px-4 pb-2">
      <UTabs
        :model-value="type"
        :items="types"
        :content="false"
        variant="pill"
        size="md"
        aria-label="Transaction type"
        :ui="{ trigger: 'h-10' }"
        @update:model-value="setType($event as Mode)"
      />
    </div>

    <UForm
      id="add-transaction"
      ref="form"
      :schema="formSchema"
      :state="state"
      class="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4"
      @submit="save"
    >
      <!-- Fields in priority order: amount and category first, prefilled details below -->
      <div class="divide-y divide-default rounded-2xl bg-muted">
        <!-- 1. Amount (hero); tapping it brings the keypad back -->
        <UFormField name="amount" :ui="{ error: 'sr-only' }">
          <template #default="{ error }">
            <AmountDisplay
              :text="amountText"
              :currency="currency"
              :type="type"
              :typing="showKeypad"
              :error="error"
              @click="openKeypad"
            />
          </template>
        </UFormField>

        <!-- 2. Transfer: from and to wallets (swappable), and the rate when their currencies differ -->
        <template v-if="type === 'transfer'">
          <div class="relative divide-y divide-default">
            <button
              v-for="side in (['from', 'to'] as const)"
              :key="side"
              type="button"
              class="flex h-14 w-full items-center gap-3 px-4 pr-16 text-left"
              @click="openWalletPicker(side)"
            >
              <UIcon
                :name="side === 'from' ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-left'"
                class="size-5 shrink-0 text-dimmed"
              />
              <span class="w-10 shrink-0 text-sm text-muted">{{ side === "from" ? "From" : "To" }}</span>
              <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{
                (side === "from" ? wallet : toWallet)?.name
              }}</span>
              <span class="shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned">{{
                side === "from" ? currency : toCurrency
              }}</span>
            </button>
            <UButton
              icon="i-lucide-arrow-down-up"
              color="neutral"
              variant="soft"
              aria-label="Swap wallets"
              class="absolute top-1/2 right-4 size-10 -translate-y-1/2 justify-center rounded-xl bg-elevated"
              @click="swapWallets"
            />
          </div>

          <UFormField v-if="!sameCurrency" name="rate" :ui="{ error: 'sr-only' }">
            <template #default="{ error }">
              <div class="flex items-start gap-3 px-4 py-3">
                <UIcon name="i-lucide-repeat" class="mt-0.5 size-5 shrink-0 text-dimmed" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs" :class="error ? 'text-error' : 'text-muted'" aria-hidden="true">
                    {{ error || "Exchange rate" }}
                  </p>
                  <div class="mt-1 flex items-center gap-2">
                    <span class="shrink-0 text-sm font-medium text-toned">1 {{ rateBase }} =</span>
                    <UInput
                      ref="rateInput"
                      :model-value="rateText"
                      variant="none"
                      placeholder="0"
                      inputmode="decimal"
                      :maxlength="20"
                      autocomplete="off"
                      enterkeyhint="done"
                      :aria-label="`Exchange rate, ${rateQuote} for 1 ${rateBase}`"
                      class="min-w-0 flex-1"
                      :ui="{ base: 'p-0 font-display text-lg font-semibold tabular-nums caret-primary ring-0' }"
                      @update:model-value="onRateUpdate"
                      @focus="onFieldFocus('rate')"
                      @blur="onFieldBlur"
                      @keydown.enter.prevent="closeKeyboard"
                    />
                    <span class="shrink-0 text-sm font-medium text-toned">{{ rateQuote }}</span>
                    <!-- mousedown.prevent keeps the keyboard open while turning it round -->
                    <UButton
                      icon="i-lucide-arrow-left-right"
                      color="neutral"
                      variant="ghost"
                      :aria-label="`Type the rate for 1 ${rateQuote} instead`"
                      class="-mr-2 size-10 shrink-0 justify-center"
                      @mousedown.prevent
                      @click="flipRate"
                    />
                  </div>
                  <p v-if="received !== undefined" class="mt-1 text-sm text-muted">
                    Arrives as
                    <span class="font-medium text-toned tabular-nums">{{ formatMoney(received, toCurrency) }}</span>
                  </p>
                </div>
              </div>
            </template>
          </UFormField>
        </template>

        <!-- 2. Category: opens the category modal (fixed for a goal's money) -->
        <UFormField v-else name="categoryId" :ui="{ error: 'sr-only' }">
          <template #default="{ error }">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left"
              :disabled="!!goal"
              @click="categoryOpen = true"
            >
              <IconTile
                v-if="category"
                :icon="category.icon ?? 'i-lucide-tag'"
                :color="category.color"
                size="sm"
              />
              <span
                v-else
                class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-dashed"
                :class="
                  error
                    ? 'border-error text-error'
                    : 'border-accented text-dimmed'
                "
              >
                <UIcon name="i-lucide-shapes" class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block text-xs"
                  :class="error ? 'text-error' : 'text-muted'"
                >
                  {{ error || (goal ? "Goal" : "Category") }}
                </span>
                <span
                  class="block truncate font-medium"
                  :class="category ? 'text-highlighted' : 'text-dimmed'"
                  >{{ category?.name ?? "Select category" }}</span
                >
              </span>
              <UIcon
                v-if="!goal"
                name="i-lucide-chevron-right"
                class="size-5 shrink-0 text-dimmed"
              />
            </button>
          </template>
        </UFormField>

        <!-- 3. Details: already filled in, change only when needed -->
        <DayPicker v-model="pickedDay" />

        <button
          v-if="type !== 'transfer' && walletChoices.length > 1"
          type="button"
          class="flex h-12 w-full items-center gap-3 px-4 text-left"
          @click="openWalletPicker('from')"
        >
          <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-dimmed" />
          <span class="flex-1 text-sm text-muted">Wallet</span>
          <span class="truncate text-sm font-medium text-highlighted">{{
            wallet?.name
          }}</span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 shrink-0 text-dimmed"
          />
        </button>

        <UFormField name="note" :ui="{ error: 'mt-0 px-4 pb-3' }">
          <label class="flex min-h-12 items-start gap-3 px-4 py-3">
            <UIcon
              name="i-lucide-pen-line"
              class="mt-0.5 size-5 shrink-0"
              :class="focusedField === 'note' ? 'text-primary' : 'text-dimmed'"
            />
            <!-- Grows to 3 lines, then scrolls; Enter closes the keyboard instead of adding a line break -->
            <UTextarea
              v-model="note"
              variant="none"
              :rows="1"
              autoresize
              :maxrows="3"
              placeholder="Add a note"
              :maxlength="100"
              autocomplete="off"
              enterkeyhint="done"
              aria-label="Note"
              class="min-w-0 flex-1"
              :ui="{ base: 'resize-none p-0 text-base leading-6 ring-0' }"
              @focus="onFieldFocus('note')"
              @blur="onFieldBlur"
              @keydown.enter.prevent="closeKeyboard"
            />
            <!-- mousedown.prevent keeps the keyboard open while clearing -->
            <button
              v-if="note"
              type="button"
              aria-label="Clear note"
              class="-my-2.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-dimmed transition-colors hover:text-toned"
              @mousedown.prevent
              @click="note = ''"
            >
              <UIcon name="i-lucide-circle-x" class="size-5" />
            </button>
          </label>
        </UFormField>
      </div>
    </UForm>

    <!-- Docked keypad with Save right above it. The side button slides the keypad down / back up;
         while typing a note only Save stays, above the keyboard. -->
    <div
      class="shrink-0 rounded-t-3xl bg-muted px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div class="flex gap-2">
        <!-- Save and stay for the next entry (new transactions only) -->
        <UButton
          v-if="!isEdit"
          type="submit"
          form="add-transaction"
          label="Add & new"
          color="neutral"
          variant="soft"
          size="xl"
          :loading="form?.loading && addAnother"
          class="h-13 flex-1 justify-center bg-elevated"
          @click="addAnother = true"
        />
        <UButton
          type="submit"
          form="add-transaction"
          :label="
            isEdit
              ? 'Save changes'
              : type === 'transfer'
                ? 'Add transfer'
                : type === 'income'
                  ? 'Add income'
                  : 'Add expense'
          "
          size="xl"
          block
          :loading="form?.loading && !addAnother"
          class="h-13 flex-1 justify-center"
          @click="addAnother = false"
        />
        <UButton
          :icon="showKeypad ? 'i-lucide-chevron-down' : 'i-lucide-calculator'"
          color="neutral"
          variant="soft"
          size="xl"
          :aria-label="showKeypad ? 'Hide keypad' : 'Show keypad'"
          :aria-expanded="showKeypad"
          aria-controls="keypad"
          class="size-13 justify-center bg-elevated"
          @click="showKeypad ? (keypadOpen = false) : openKeypad()"
        />
      </div>
      <!-- 1fr ↔ 0fr row animates the keypad's real height -->
      <div
        id="keypad"
        class="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        :class="showKeypad ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        :inert="!showKeypad"
      >
        <div class="overflow-hidden">
          <AmountKeypad
            v-model="amountText"
            :decimals="digits"
            calculator
            tiles
            class="pt-3"
          />
        </div>
      </div>
    </div>

    <CategoryModal
      v-if="type !== 'transfer'"
      v-model:open="categoryOpen"
      :type="type"
      :account-id="accountId"
      :selected-id="categoryId"
      @select="categoryId = $event"
    />

    <WalletSelectModal
      v-model:open="walletOpen"
      :wallets="type === 'transfer' ? (wallets ?? []) : walletChoices"
      :selected-id="walletTarget === 'to' ? toAccountId : accountId"
      @select="type !== 'transfer' ? pickWallet($event) : walletTarget === 'to' ? pickTo($event) : pickFrom($event)"
    />
  </div>
</template>


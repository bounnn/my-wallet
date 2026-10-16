<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

definePageMeta({ layout: false });

// /add?id=12 edits that transaction instead of adding a new one
const editId = Number(useRoute().query.id) || undefined;
useHead({ title: editId ? "Edit transaction" : "Add transaction" });

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);

// --- Type: expense / income ---
const type = ref<Transaction["type"]>("expense");
const types = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
];

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
// Categories are per type, so switching type clears the pick
function setType(value: Transaction["type"]) {
  if (value !== type.value) categoryId.value = undefined;
  type.value = value;
}

// --- Date: today by default (DayPicker) ---
const now = new Date();
const pickedDay = shallowRef(
  new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
);

// --- Note: typing it swaps the keypad for the phone keyboard ---
const note = ref("");
const noteInput = useTemplateRef("noteInput");
const noteFocused = ref(false);
let keypadTimer: ReturnType<typeof setTimeout> | undefined;

function onNoteFocus() {
  clearTimeout(keypadTimer);
  noteFocused.value = true;
}
// Bring the keypad back a moment later, so a tap on Save isn't shifted by the layout change
function onNoteBlur() {
  keypadTimer = setTimeout(() => (noteFocused.value = false), 150);
}
const closeKeyboard = () => noteInput.value?.textareaRef?.blur();

// The keypad can be slid down to see the whole form; tapping the amount brings it back
const keypadOpen = ref(true);
const showKeypad = computed(() => keypadOpen.value && !noteFocused.value);
function openKeypad() {
  closeKeyboard();
  keypadOpen.value = true;
}

// Keep the screen (and its Save button) above the on-screen keyboard
const viewport = useVisualViewport();

// --- Scan: a bill photo or bank screenshot is read on the review screen, which replaces this one ---
const scanInput = useTemplateRef("scanInput");
function pickScan(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Lets the same image be picked again
  input.value = "";
  if (!file) return;
  pendingScan.value = file;
  navigateTo("/scan", { replace: true });
}

// --- Edit: fill the form from the saved transaction; a missing one (deleted meanwhile) goes home ---
const editing = shallowRef<Transaction>();
// Money added to / taken out of a goal: type and category stay the goal's, so it keeps counting there
const goal = shallowRef<Goal>();
onMounted(async () => {
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
const state = reactive({ amount: amountText, categoryId, accountId, note });
const schema = v.object({
  amount: v.pipe(
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
  ),
  categoryId: v.number("Pick a category"),
  accountId: v.number("Pick a wallet"),
  note: v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(100, "Keep the note under 100 characters"),
  ),
});

// The keypad and the category / wallet pickers aren't form inputs, so a change clears their error by hand
const form = useTemplateRef("form");
watch(amountText, () => form.value?.clear("amount"));
watch(categoryId, () => form.value?.clear("categoryId"));

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

async function save({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  // The picked day at the current time, so same-day entries keep their order.
  // An edit keeps the transaction's own time.
  const time = editing.value?.date ?? new Date();
  const day = pickedDay.value.toDate(getLocalTimeZone());
  const date = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
  );

  try {
    await saveTransaction(
      { ...data, type: type.value, note: data.note || undefined, date },
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
    <!-- Top bar: back + title, expense / income switch on the right (one tap, no menu) -->
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
        {{ editId ? (type === "income" ? "Edit income" : "Edit expense") : "Add new" }}
      </h1>
      <template v-if="!editId">
        <UButton
          icon="i-lucide-scan-text"
          color="neutral"
          variant="ghost"
          aria-label="Scan bill or screenshot"
          @click="scanInput?.click()"
        />
        <input ref="scanInput" type="file" accept="image/*" class="hidden" @change="pickScan" />
      </template>
      <span
        v-if="goal"
        class="shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned"
      >
        {{ type === "expense" ? "Added to goal" : "Taken out of goal" }}
      </span>
      <UTabs
        v-else
        :model-value="type"
        :items="types"
        :content="false"
        variant="pill"
        size="md"
        aria-label="Transaction type"
        class="w-48 shrink-0"
        :ui="{ trigger: 'h-10' }"
        @update:model-value="setType($event as Transaction['type'])"
      />
    </header>

    <UForm
      id="add-transaction"
      ref="form"
      :schema="schema"
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

        <!-- 2. Category: opens the category modal (fixed for a goal's money) -->
        <UFormField name="categoryId" :ui="{ error: 'sr-only' }">
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
          v-if="walletChoices.length > 1"
          type="button"
          class="flex h-12 w-full items-center gap-3 px-4 text-left"
          @click="walletOpen = true"
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
              :class="noteFocused ? 'text-primary' : 'text-dimmed'"
            />
            <!-- Grows to 3 lines, then scrolls; Enter closes the keyboard instead of adding a line break -->
            <UTextarea
              ref="noteInput"
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
              @focus="onNoteFocus"
              @blur="onNoteBlur"
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
          v-if="!editId"
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
          :label="editId ? 'Save changes' : type === 'income' ? 'Add income' : 'Add expense'"
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
      v-model:open="categoryOpen"
      :type="type"
      :account-id="accountId"
      :selected-id="categoryId"
      @select="categoryId = $event"
    />

    <WalletSelectModal
      v-model:open="walletOpen"
      :wallets="walletChoices"
      :selected-id="accountId"
      @select="pickWallet"
    />
  </div>
</template>


<script setup lang="ts">
import {
  CalendarDate,
  getLocalTimeZone,
  type DateValue,
} from "@internationalized/date";
import * as v from "valibot";

definePageMeta({ layout: false });

// /add?id=12 edits that transaction instead of adding a new one
const editId = Number(useRoute().query.id) || undefined;

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
const isExpression = computed(() => hasOperator(amountText.value));
const amount = computed(() => {
  const n = Number.parseFloat(amountText.value);
  return Number.isFinite(n) ? toMinor(n, currency.value) : 0;
});
const amountDisplay = computed(() =>
  isExpression.value
    ? formatExpression(amountText.value)
    : formatAmountInput(amountText.value),
);

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

// --- Date: today by default; Today / Yesterday are one tap, other days in a calendar modal ---
const now = new Date();
const today = new CalendarDate(
  now.getFullYear(),
  now.getMonth() + 1,
  now.getDate(),
);
const yesterday = today.subtract({ days: 1 });
const pickedDay = shallowRef<CalendarDate>(today);
const calendarOpen = ref(false);
const pickedDate = computed(() => pickedDay.value.toDate(getLocalTimeZone()));
const isOtherDay = computed(
  () =>
    pickedDay.value.compare(today) !== 0 &&
    pickedDay.value.compare(yesterday) !== 0,
);
const isFutureDay = (d: DateValue) => d.compare(today) > 0;

function onPickDay(value: DateValue | undefined) {
  if (!value) return;
  pickedDay.value = new CalendarDate(value.year, value.month, value.day);
  calendarOpen.value = false;
}

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
const closeKeyboard = () => noteInput.value?.blur();

// The keypad can be slid down to see the whole form; tapping the amount brings it back
const keypadOpen = ref(true);
const showKeypad = computed(() => keypadOpen.value && !noteFocused.value);
function openKeypad() {
  closeKeyboard();
  keypadOpen.value = true;
}

// The note grows with its text, up to 3 lines (max-h on the textarea), then scrolls
watch(
  note,
  () => {
    const el = noteInput.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  },
  { flush: "post" },
);

// Keep the screen (and its Save button) above the on-screen keyboard
const viewport = useVisualViewport();

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
  goal.value = await db.goals.where("categoryId").equals(t.categoryId).first();
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
const schema = v.object({
  amount: v.pipe(v.number(), v.minValue(1, "Enter an amount above 0")),
  categoryId: v.number("Pick a category"),
  accountId: v.number("Pick a wallet"),
  note: v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(100, "Keep the note under 100 characters"),
  ),
});
const errors = ref<v.FlatErrors<typeof schema>["nested"]>({});
watch(amountText, () => (errors.value.amount = undefined));
watch(categoryId, () => (errors.value.categoryId = undefined));
watch(note, () => (errors.value.note = undefined));

const saving = ref(false);
const toast = useToast();

async function save() {
  const result = v.safeParse(schema, {
    amount: amount.value,
    categoryId: categoryId.value,
    accountId: accountId.value,
    note: note.value,
  });
  if (!result.success || isExpression.value) {
    errors.value = result.success
      ? {}
      : (v.flatten<typeof schema>(result.issues).nested ?? {});
    // An unfinished sum isn't an amount yet
    if (isExpression.value) {
      const total = evaluateExpression(amountText.value);
      errors.value.amount = [
        Number.isFinite(total) && total > 0
          ? "Press = to get the total"
          : "This sum doesn't give an amount above 0",
      ];
    }
    return;
  }

  // A goal's saved amount can't go below 0 (same rule as taking money out on the plan screen)
  if (goal.value) {
    const others = await loadGoalSaved(goal.value, editing.value?.id);
    const amount = result.output.amount;
    if (others + (type.value === "expense" ? amount : -amount) < 0) {
      errors.value.amount = [
        type.value === "income"
          ? `Only ${formatMoney(Math.max(others, 0), goal.value.currency)} saved`
          : `At least ${formatMoney(-others, goal.value.currency)}, it was taken out since`,
      ];
      return;
    }
  }

  // The picked day at the current time, so same-day entries keep their order.
  // An edit keeps the transaction's own time.
  const now = new Date();
  const time = editing.value?.date ?? now;
  const day = pickedDate.value;
  const date = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
  );

  saving.value = true;
  try {
    const fields = {
      accountId: result.output.accountId,
      categoryId: result.output.categoryId,
      type: type.value,
      amount: result.output.amount,
      note: result.output.note || undefined,
      date,
    };
    if (editing.value) await db.transactions.update(editing.value.id, fields);
    else await db.transactions.add({ ...fields, createdAt: now });
    toast.add({
      title: editing.value ? "Changes saved" : type.value === "income" ? "Income added" : "Expense added",
      description: formatMoney(result.output.amount, currency.value),
      color: "success",
      icon: "i-lucide-circle-check",
    });
    close();
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

// Go back when the screen was opened from inside the app, otherwise home (e.g. after a reload)
function close() {
  if (window.history.state?.back) useRouter().back();
  else navigateTo("/", { replace: true });
}

const chip = (active: boolean) =>
  active
    ? "bg-primary/20 text-navy-100"
    : "bg-elevated text-muted hover:text-toned";
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
    <header class="flex h-12 shrink-0 items-center gap-2 px-4">
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
        {{ editId ? "Edit" : "Add new" }}
      </h1>
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
        size="xs"
        aria-label="Transaction type"
        class="w-40 shrink-0"
        @update:model-value="setType($event as Transaction['type'])"
      />
    </header>

    <form
      id="add-transaction"
      class="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4"
      @submit.prevent="save"
    >
      <!-- Fields in priority order: amount and category first, prefilled details below -->
      <div class="divide-y divide-default rounded-2xl bg-muted">
        <!-- 1. Amount (hero); tapping it brings the keypad back -->
        <div class="px-4 pt-3 pb-4" @click="openKeypad">
          <div class="flex items-center justify-between">
            <span
              class="text-sm"
              :class="errors.amount ? 'text-error' : 'text-muted'"
            >
              {{ errors.amount?.[0] ?? "Amount" }}
            </span>
            <span
              class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned"
              >{{ currency }}</span
            >
          </div>
          <div class="mt-1 flex h-14 items-center">
            <p
              class="flex min-w-0 flex-1 items-baseline gap-1.5 font-display font-bold tracking-tight tabular-nums"
              aria-live="polite"
            >
              <span class="text-2xl text-dimmed">{{
                currencySymbol(currency)
              }}</span>
              <span
                class="truncate transition-colors"
                :class="[
                  amountDisplay.length > 14
                    ? 'text-3xl'
                    : amountDisplay.length > 9
                      ? 'text-4xl'
                      : 'text-5xl',
                  !amountText
                    ? 'text-dimmed'
                    : isExpression
                      ? 'text-toned'
                      : type === 'income'
                        ? 'text-success'
                        : 'text-highlighted',
                ]"
                ><template v-if="!isExpression">{{
                  type === "income" ? "+" : "-"
                }}</template
                >{{ amountDisplay }}</span
              >
              <span
                v-if="showKeypad"
                class="caret h-9 w-0.5 self-center rounded-full bg-primary"
                aria-hidden="true"
              />
            </p>
          </div>
        </div>

        <!-- 2. Category: opens the category modal (fixed for a goal's money) -->
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
              errors.categoryId
                ? 'border-error text-error'
                : 'border-accented text-dimmed'
            "
          >
            <UIcon name="i-lucide-shapes" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block text-xs"
              :class="errors.categoryId ? 'text-error' : 'text-muted'"
            >
              {{ errors.categoryId?.[0] ?? (goal ? "Goal" : "Category") }}
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

        <!-- 3. Details: already filled in, change only when needed -->
        <div class="flex h-12 items-center gap-3 px-4">
          <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-dimmed" />
          <div
            class="flex min-w-0 flex-1 gap-1.5"
            role="group"
            aria-label="Date"
          >
            <button
              type="button"
              class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              :class="chip(pickedDay.compare(today) === 0)"
              :aria-pressed="pickedDay.compare(today) === 0"
              @click="pickedDay = today"
            >
              Today
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              :class="chip(pickedDay.compare(yesterday) === 0)"
              :aria-pressed="pickedDay.compare(yesterday) === 0"
              @click="pickedDay = yesterday"
            >
              Yesterday
            </button>
            <button
              type="button"
              class="inline-flex min-w-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors"
              :class="chip(isOtherDay)"
              :aria-label="
                isOtherDay
                  ? `Date: ${dayLabel(pickedDate)}`
                  : 'Pick another day'
              "
              @click="calendarOpen = true"
            >
              <span v-if="isOtherDay" class="truncate">{{
                dayLabel(pickedDate)
              }}</span>
              <UIcon v-else name="i-lucide-ellipsis" class="size-4" />
            </button>
          </div>
        </div>

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

        <label class="flex min-h-12 items-start gap-3 px-4 py-3">
          <UIcon
            name="i-lucide-pen-line"
            class="mt-0.5 size-5 shrink-0"
            :class="noteFocused ? 'text-primary' : 'text-dimmed'"
          />
          <!-- Grows to 3 lines; Enter closes the keyboard instead of adding a line break -->
          <textarea
            ref="noteInput"
            v-model="note"
            rows="1"
            placeholder="Add a note"
            maxlength="100"
            autocomplete="off"
            enterkeyhint="done"
            aria-label="Note"
            class="max-h-[4.5rem] min-w-0 flex-1 resize-none bg-transparent text-base leading-6 text-highlighted outline-none placeholder:text-dimmed"
            @focus="onNoteFocus"
            @blur="onNoteBlur"
            @keydown.enter.prevent="closeKeyboard"
          />
          <!-- mousedown.prevent keeps the keyboard open while clearing -->
          <button
            v-if="note"
            type="button"
            aria-label="Clear note"
            class="-my-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-dimmed transition-colors hover:text-toned"
            @mousedown.prevent
            @click="note = ''"
          >
            <UIcon name="i-lucide-circle-x" class="size-5" />
          </button>
        </label>
      </div>
      <p v-if="errors.note" class="mt-2 px-1 text-sm text-error">
        {{ errors.note[0] }}
      </p>
    </form>

    <!-- Docked keypad with Save right above it. The side button slides the keypad down / back up;
         while typing a note only Save stays, above the keyboard. -->
    <div
      class="shrink-0 rounded-t-3xl bg-muted px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div class="flex gap-2">
        <UButton
          type="submit"
          form="add-transaction"
          :label="editId ? 'Save changes' : type === 'income' ? 'Add income' : 'Add expense'"
          size="xl"
          block
          :loading="saving"
          class="h-13 flex-1 justify-center"
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

    <UModal v-model:open="calendarOpen" title="Pick a date">
      <template #body>
        <UCalendar
          :model-value="pickedDay"
          :is-date-disabled="isFutureDay"
          class="mx-auto"
          @update:model-value="onPickDay"
        />
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Blinking caret: the amount is the field being typed into */
.caret {
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}
</style>

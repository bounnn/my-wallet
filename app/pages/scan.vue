<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";

// Review a scanned bill or bank screenshot (picked on the add screen): every payment found is listed,
// ticked ones are saved together. Each can be edited first (wallet, amount, category, date, note); the
// category is the on-device AI's best guess.
definePageMeta({ layout: false });
useHead({ title: "Scanned bill" });

const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
// Read once when the drafts are made, so the home wallet is known even before the live query loads
const walletsAtScan = shallowRef<Account[]>();
const { wallet: activeWallet } = useActiveWallet(walletsAtScan);

const toast = useToast();

// --- Reading: the images handed over from the add screen (up to 5), one after another; without any (e.g. a
// reload) there's nothing to show ---
const files = pendingScan.value;
pendingScan.value = [];
if (!files.length) navigateTo("/add", { replace: true });

const reading = ref(true);
// The image being read (0-based) and how far along it is (0–1)
const readIndex = ref(0);
const readProgress = ref(0);
const overallProgress = computed(() => (readIndex.value + readProgress.value) / Math.max(files.length, 1));
const readError = ref("");
// Deep, so ticking and suggestions update in place. Each day is kept raw: a CalendarDate has private fields,
// which break inside a reactive proxy.
const drafts = ref([]) as Ref<ScanDraft[]>;

// The bill's wallet: the one home shows, unless the bill names another currency that a wallet has
function walletFor(all: Account[], currency?: string) {
  const active = activeWallet.value;
  if (!currency || active?.currency === currency) return active;
  return all.find((w) => w.currency === currency) ?? active;
}

// Same wallet, day, type and amount as a saved transaction: probably added before (screenshots overlap)
async function alreadyAdded(accountId: number, type: Transaction["type"], amount: number, day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const count = await db.transactions
    .where("[accountId+date]")
    .between([accountId, start], [accountId, end], true, false)
    .filter((t) => t.type === type && t.amount === amount)
    .count();
  return count > 0;
}

async function toDrafts(payments: ScannedPayment[]) {
  const all = await db.accounts.toArray();
  walletsAtScan.value = all;
  const now = new Date();
  return Promise.all(
    payments.map(async (p, key): Promise<ScanDraft> => {
      const wallet = walletFor(all, p.currency);
      const date = p.date ?? now;
      const maybeAdded = wallet
        ? await alreadyAdded(wallet.id, p.type, toMinor(p.amount, wallet.currency), date)
        : false;
      return {
        key,
        include: !maybeAdded,
        type: p.type,
        accountId: wallet?.id,
        amountText: groupAmountInput(String(p.amount), wallet?.currency ?? "USD"),
        day: markRaw(new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())),
        time: date,
        note: p.note ?? "",
        billCurrency: p.currency,
        maybeAdded,
        suggestions: [],
        image: p.image,
      };
    }),
  );
}

// --- Category suggestions, one payment after another (the model loads once) ---
const suggesting = ref(false);
const modelDownload = ref<number>();

async function suggestAll(payments: ScannedPayment[]) {
  // Goals aren't suggested: money for a goal is added on purpose, not from a bill
  const goalCategories = new Set((await db.goals.toArray()).map((g) => g.categoryId));
  const usable = (await db.categories.toArray()).filter((c) => !c.archived && !goalCategories.has(c.id));
  suggesting.value = true;
  try {
    for (const [i, p] of payments.entries()) {
      const ranked = await suggestCategories(
        p.text,
        usable.filter((c) => c.type === p.type),
        (progress) => (modelDownload.value = progress),
      );
      const draft = drafts.value[i];
      if (!draft) continue;
      draft.suggestions = ranked.slice(0, 3);
      // A category picked by hand meanwhile stays
      draft.categoryId ??= ranked[0];
    }
  } catch (err) {
    toast.add({
      title: "Couldn't suggest categories",
      description: errorText(err),
      color: "warning",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    suggesting.value = false;
    modelDownload.value = undefined;
  }
}

onMounted(async () => {
  if (!files.length) return;
  // An image that can't be read is skipped; the others still count
  const found: ScannedPayment[] = [];
  let failed = 0;
  let lastError: unknown;
  for (const [image, file] of files.entries()) {
    readIndex.value = image;
    readProgress.value = 0;
    try {
      const text = await readImage(file, (p) => (readProgress.value = p));
      found.push(...findPayments(text).map((p) => ({ ...p, image })));
    } catch (err) {
      failed++;
      lastError = err;
    }
  }

  const payments = dropRepeats(found);
  try {
    if (failed === files.length) throw lastError;
    drafts.value = await toDrafts(payments);
  } catch (err) {
    readError.value = errorText(err);
    return;
  } finally {
    reading.value = false;
  }
  if (failed) {
    toast.add({
      title: `Couldn't read ${failed} of ${files.length} images`,
      description: "The payments below are from the others.",
      color: "warning",
      icon: "i-lucide-circle-alert",
    });
  }
  if (payments.length) suggestAll(payments);
});

// --- List ---
const walletOf = (d: ScanDraft) => wallets.value?.find((w) => w.id === d.accountId);
const categoryOf = (d: ScanDraft) => categories.value?.find((c) => c.id === d.categoryId);
const currencyOf = (d: ScanDraft) => walletOf(d)?.currency ?? "USD";
const amountOf = (d: ScanDraft) => parseAmount(d.amountText, currencyOf(d));
const signedOf = (d: ScanDraft) => (d.type === "income" ? amountOf(d) : -amountOf(d));
// What a ticked payment still needs before it can be saved
function problemOf(d: ScanDraft) {
  if (!walletOf(d)) return "Pick a wallet";
  if (!(amountOf(d) > 0)) return "Enter an amount";
  if (d.categoryId === undefined) return "Pick a category";
  return undefined;
}

const chosen = computed(() => drafts.value.filter((d) => d.include));
const allChosen = computed(() => drafts.value.length > 0 && chosen.value.length === drafts.value.length);
function chooseAll() {
  const include = !allChosen.value;
  for (const d of drafts.value) d.include = include;
}

// --- Edit one ---
const editing = shallowRef<ScanDraft>();
const editOpen = ref(false);
function edit(d: ScanDraft) {
  editing.value = d;
  editOpen.value = true;
}
function saveEdit(updated: ScanDraft) {
  const i = drafts.value.findIndex((d) => d.key === updated.key);
  if (i >= 0) drafts.value[i] = { ...updated, day: markRaw(updated.day) };
}

// --- Save all ticked, together: either all are added or none ---
const saving = ref(false);
const showProblems = ref(false);

async function saveAll() {
  showProblems.value = true;
  if (!chosen.value.length || chosen.value.some(problemOf)) return;
  saving.value = true;
  try {
    await db.transaction("rw", db.transactions, db.goals, async () => {
      for (const d of chosen.value) {
        const day = d.day.toDate(getLocalTimeZone());
        await saveTransaction({
          accountId: d.accountId!,
          categoryId: d.categoryId!,
          type: d.type,
          amount: amountOf(d),
          note: d.note.trim() || undefined,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            d.time.getHours(),
            d.time.getMinutes(),
            d.time.getSeconds(),
          ),
        });
      }
    });
  } catch (err) {
    toast.add({
      title: "Couldn't save the transactions",
      description: errorText(err),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
    return;
  } finally {
    saving.value = false;
  }
  const count = chosen.value.length;
  toast.add({
    title: count === 1 ? "1 transaction added" : `${count} transactions added`,
    color: "success",
    icon: "i-lucide-circle-check",
  });
  close();
}

// Back to where the scan started (the add screen was replaced by this one), otherwise home
function close() {
  if (window.history.state?.back) useRouter().back();
  else navigateTo("/", { replace: true });
}
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)]">
    <header class="flex h-14 shrink-0 items-center gap-2 px-4">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" aria-label="Back" class="-ml-2" @click="close" />
      <h1 class="flex-1 truncate font-display text-lg font-semibold tracking-tight text-highlighted">Scanned bill</h1>
      <UButton
        v-if="drafts.length > 1"
        :label="allChosen ? 'Clear all' : 'Select all'"
        color="neutral"
        variant="ghost"
        @click="chooseAll"
      />
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <!-- Reading -->
      <div v-if="reading" class="space-y-3 rounded-2xl bg-muted p-4" role="status">
        <p class="text-sm text-muted">
          {{
            !overallProgress
              ? "Getting the text reader ready"
              : files.length > 1
                ? `Reading image ${readIndex + 1} of ${files.length} on this phone`
                : "Reading the bill on this phone"
          }}
        </p>
        <UProgress :model-value="overallProgress ? Math.round(overallProgress * 100) : null" />
      </div>

      <div v-else-if="readError" class="rounded-2xl bg-muted p-4">
        <p class="font-medium text-highlighted">Couldn't read the image</p>
        <p class="mt-1 text-sm text-muted">{{ readError }}</p>
      </div>

      <div v-else-if="!drafts.length" class="rounded-2xl bg-muted p-4">
        <p class="font-medium text-highlighted">No total found</p>
        <p class="mt-1 text-sm text-muted">Try a sharper photo with the total in view, or enter it by hand.</p>
      </div>

      <template v-else>
        <p v-if="suggesting" class="mb-3 flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <UIcon name="i-lucide-sparkles" class="size-4 shrink-0" />
          {{
            modelDownload === undefined
              ? "Suggesting categories"
              : `Downloading the category AI, first time only (${Math.round(modelDownload * 100)}%)`
          }}
        </p>
        <p v-else class="mb-3 text-sm text-muted">Tap a payment to change it before saving</p>

        <ul class="space-y-3">
          <li
            v-for="d in drafts"
            :key="d.key"
            class="flex items-start gap-1 rounded-2xl bg-muted pr-4 transition-opacity"
            :class="d.include ? '' : 'opacity-60'"
          >
            <!-- Own tap target, apart from the row that opens the editor -->
            <label class="flex size-12 shrink-0 cursor-pointer items-center justify-center self-center">
              <UCheckbox v-model="d.include" :aria-label="`Add ${d.note || 'this payment'}`" />
            </label>
            <button type="button" class="flex min-w-0 flex-1 items-start gap-3 py-4 text-left" @click="edit(d)">
              <IconTile
                v-if="categoryOf(d)"
                :icon="categoryOf(d)!.icon ?? 'i-lucide-tag'"
                :color="categoryOf(d)!.color"
                size="sm"
              />
              <span
                v-else
                class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-dashed border-accented text-dimmed"
              >
                <UIcon :name="suggesting ? 'i-lucide-sparkles' : 'i-lucide-shapes'" class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-start gap-2">
                  <span class="min-w-0 flex-1 truncate font-medium" :class="categoryOf(d) ? 'text-highlighted' : 'text-dimmed'">
                    {{ categoryOf(d)?.name ?? (suggesting ? "Suggesting" : "No category") }}
                  </span>
                  <MoneyAmount
                    :amount="signedOf(d) || 0"
                    :currency="currencyOf(d)"
                    signed
                    align="end"
                    class="shrink-0"
                    :amount-class="['font-semibold', d.type === 'income' ? 'text-success' : 'text-highlighted'].join(' ')"
                  />
                </span>
                <span v-if="d.note" class="block truncate text-sm text-muted">{{ d.note }}</span>
                <span class="mt-2 flex flex-wrap gap-1.5">
                  <span class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned">
                    {{ dayLabel(d.day.toDate(getLocalTimeZone())) }}
                  </span>
                  <span v-if="walletOf(d)" class="truncate rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned">
                    {{ walletOf(d)!.name }}
                  </span>
                  <span
                    v-if="files.length > 1 && d.image !== undefined"
                    class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned"
                  >
                    Image {{ d.image + 1 }}
                  </span>
                  <span
                    v-if="d.billCurrency && walletOf(d) && d.billCurrency !== walletOf(d)!.currency"
                    class="rounded-md bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning"
                  >
                    Bill in {{ d.billCurrency }}
                  </span>
                  <span v-if="d.maybeAdded" class="rounded-md bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                    Maybe added already
                  </span>
                </span>
                <span
                  v-if="showProblems && d.include && problemOf(d)"
                  class="mt-2 flex items-center gap-1.5 text-xs text-error"
                >
                  <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" />
                  {{ problemOf(d) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </template>
    </main>

    <!-- Docked save, like the add screen's -->
    <div v-if="drafts.length" class="shrink-0 rounded-t-3xl bg-muted px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <UButton
        :label="
          chosen.length === 0
            ? 'Tick a payment to add'
            : chosen.length === 1
              ? 'Add 1 transaction'
              : `Add ${chosen.length} transactions`
        "
        size="xl"
        block
        :disabled="!chosen.length"
        :loading="saving"
        class="h-13 justify-center"
        @click="saveAll"
      />
    </div>

    <ScanDraftModal v-model:open="editOpen" :draft="editing" :wallets="wallets ?? []" @save="saveEdit" />
  </div>
</template>

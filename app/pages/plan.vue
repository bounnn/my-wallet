<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";

// My Plan (ui/ref1, right screen): the picked wallet's savings goals with progress against their due date,
// then its budgets for the picked month as bars (each month starts empty; earlier budgets can be copied in)
const { value: wallets } = useLiveQuery(() => db.accounts.toArray(), []);
const { value: transactions } = useLiveQuery(() => db.transactions.toArray(), []);
const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);
const { value: budgets } = useLiveQuery(() => db.budgets.toArray(), []);

// Goals and budgets belong to a wallet (same picker as home); categories are shared
const { wallet } = useActiveWallet(wallets);
const accountId = computed(() => wallet.value?.id);
const currency = computed(() => wallet.value?.currency ?? "USD");
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

// --- Goals ---

type Status = { tone: "success" | "error" | "info"; icon: string; text: string };

const savedFor = (g: Goal) => goalSaved(g, transactions.value ?? []);

// Unfinished goals first, oldest first within each group
const goalCards = computed(() =>
  (goals.value ?? [])
    .filter((g) => g.accountId === accountId.value)
    .map((g) => {
      const category = categoryById.value.get(g.categoryId);
      const saved = savedFor(g);
      const progress = g.target ? Math.min(Math.max(saved / g.target, 0), 1) : 0;
      const left = Math.max(g.target - saved, 0);
      // Where saving should be by now if it went evenly from the start to the due date
      const expected = g.deadline
        ? Math.min(Math.max((now.getTime() - g.createdAt.getTime()) / (g.deadline.getTime() - g.createdAt.getTime()), 0), 1)
        : 0;
      const behind = left > 0 && expected - progress > 0.05 ? expected - progress : 0;
      return {
        goal: g,
        category,
        name: category?.name ?? "Goal",
        icon: category?.icon ?? "i-lucide-piggy-bank",
        color: category?.color ?? "primary",
        saved,
        progress,
        left,
        behind,
        status: goalStatus(g, left, behind),
      };
    })
    .sort((a, b) => Number(!a.left) - Number(!b.left) || a.goal.createdAt.getTime() - b.goal.createdAt.getTime()),
);
type GoalCard = (typeof goalCards.value)[number];

function goalStatus(g: Goal, left: number, behind: number): Status | undefined {
  if (!left) return { tone: "success", icon: "i-lucide-party-popper", text: "Goal reached, well done" };
  if (!g.deadline) return undefined;
  const days = Math.ceil((g.deadline.getTime() - now.getTime()) / DAY);
  if (days < 0) {
    return { tone: "error", icon: "i-lucide-circle-alert", text: `Due date passed, ${formatMoney(left, g.currency)} to go` };
  }
  if (behind) {
    return { tone: "error", icon: "i-lucide-circle-alert", text: `You're ${Math.round(behind * 100)}% behind schedule` };
  }
  // On track: what's still needed per month (or the whole rest when it's due within a month)
  const months = Math.floor(days / 30);
  return months >= 1
    ? { tone: "info", icon: "i-lucide-calendar-check", text: `On track, save ${formatMoney(Math.ceil(left / months), g.currency)} a month` }
    : { tone: "info", icon: "i-lucide-calendar-check", text: `On track, due in ${days} ${days === 1 ? "day" : "days"}` };
}

// Full class names so Tailwind can find them
const statusClass: Record<Status["tone"], string> = {
  success: "bg-success/15 text-success",
  error: "bg-error/90 text-white",
  info: "bg-primary/20 text-navy-100",
};

const goalModalOpen = ref(false);
const moneyModalOpen = ref(false);
const editingGoal = shallowRef<Goal>();
// By id, so the modal's saved amount stays live
const moneyGoalId = ref<number>();
const moneyCard = computed(() => goalCards.value.find((c) => c.goal.id === moneyGoalId.value));
const moneyMode = ref<"add" | "take">("add");

function newGoal() {
  editingGoal.value = undefined;
  goalModalOpen.value = true;
}
function openMoney(card: GoalCard, mode: "add" | "take") {
  moneyGoalId.value = card.goal.id;
  moneyMode.value = mode;
  moneyModalOpen.value = true;
}

const toast = useToast();

// The goal's category is archived, not deleted, so its transactions keep their name; undo brings both back
async function deleteGoal(card: GoalCard) {
  const goal = card.goal;
  await db.transaction("rw", db.goals, db.categories, async () => {
    await db.goals.delete(goal.id);
    await db.categories.update(goal.categoryId, { archived: true });
  });
  toast.add({
    title: "Goal deleted",
    description: `${card.name} transactions are kept`,
    icon: "i-lucide-trash-2",
    actions: [
      {
        label: "Undo",
        color: "neutral",
        variant: "soft",
        onClick: () =>
          void db.transaction("rw", db.goals, db.categories, async () => {
            await db.goals.add(goal);
            await db.categories.update(goal.categoryId, { archived: false });
          }),
      },
    ],
  });
}

function goalMenu(card: GoalCard) {
  return [
    [
      { label: "Add money", icon: "i-lucide-plus", onSelect: () => openMoney(card, "add") },
      { label: "Take out", icon: "i-lucide-minus", disabled: card.saved <= 0, onSelect: () => openMoney(card, "take") },
      {
        label: "Edit",
        icon: "i-lucide-pencil",
        onSelect: () => {
          editingGoal.value = card.goal;
          goalModalOpen.value = true;
        },
      },
    ],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error" as const, onSelect: () => deleteGoal(card) }],
  ];
}

// Add money button: a soft wash of the goal's color with a faint edge, so each card's action matches its goal
const addMoneyStyle = (color: CategoryColor) => ({
  background: `linear-gradient(180deg, color-mix(in oklab, var(--ui-${color}) 28%, transparent), color-mix(in oklab, var(--ui-${color}) 16%, transparent))`,
  boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--ui-${color}) 30%, transparent)`,
});

// Track and fill in the goal's color; the hatched stretch is how far behind schedule it is (ref1)
const barTrack = (color: CategoryColor) => ({
  background: `color-mix(in oklab, var(--ui-${color}) 14%, transparent)`,
});
const barFill = (color: CategoryColor, progress: number) => ({
  width: `${progress * 100}%`,
  background: `linear-gradient(90deg, color-mix(in oklab, var(--ui-${color}) 45%, transparent), var(--ui-${color}))`,
});
const barBehind = (color: CategoryColor, progress: number, behind: number) => ({
  left: `${progress * 100}%`,
  width: `${behind * 100}%`,
  background: `repeating-linear-gradient(-60deg, color-mix(in oklab, var(--ui-${color}) 55%, transparent) 0 2px, transparent 2px 6px)`,
});

// --- Budgets: set month by month; the picked month's spending per budget against its limit ---

const pickedMonth = shallowRef(new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1));
const month = computed(() => new Date(pickedMonth.value.year, pickedMonth.value.month - 1, 1));
const pickedKey = computed(() => monthKey(month.value));
const walletBudgets = computed(() => (budgets.value ?? []).filter((b) => b.accountId === accountId.value));
const monthBudgets = computed(() => walletBudgets.value.filter((b) => b.month === pickedKey.value));

// The latest earlier month with budgets, offered for copying when the picked month has none
const longMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const previous = computed(() => {
  const key = walletBudgets.value
    .map((b) => b.month)
    .filter((m) => m < pickedKey.value)
    .sort()
    .at(-1);
  if (!key) return undefined;
  const [year, m] = key.split("-").map(Number);
  return {
    label: longMonth.format(new Date(year!, m! - 1, 1)),
    budgets: walletBudgets.value.filter((b) => b.month === key),
  };
});

const monthSpent = computed(() => {
  const from = month.value;
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const spent = new Map<number, number>();
  for (const t of transactions.value ?? []) {
    if (t.type !== "expense" || t.accountId !== accountId.value || t.date < from || t.date >= to) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  }
  return spent;
});

// Most used first, so the budgets running out sit on top
const budgetCards = computed(() =>
  monthBudgets.value
    .map((b) => {
      const tiles = b.categoryIds.map((id) => {
        const category = categoryById.value.get(id);
        return {
          id,
          name: category?.name ?? "Uncategorized",
          icon: category?.icon ?? "i-lucide-tag",
          color: category?.color ?? "primary",
        };
      });
      const spent = b.categoryIds.reduce((s, id) => s + (monthSpent.value.get(id) ?? 0), 0);
      const used = b.amount ? spent / b.amount : 0;
      return {
        budget: b,
        tiles,
        name: b.name || tiles.map((t) => t.name).join(", "),
        // The bar follows the first category's color
        color: tiles[0]?.color ?? "primary",
        spent,
        used,
        left: b.amount - spent,
      };
    })
    .sort((a, b) => b.used - a.used),
);

const budgetTotal = computed(() => budgetCards.value.reduce((s, b) => s + b.budget.amount, 0));
const budgetSpent = computed(() => budgetCards.value.reduce((s, b) => s + b.spent, 0));

// Bar in the category color until the limit is nearly reached
const budgetColor = (b: { used: number; color: CategoryColor }): CategoryColor =>
  b.used > 1 ? "error" : b.used >= 0.9 ? "warning" : b.color;

const budgetModalOpen = ref(false);
const editingBudget = shallowRef<Budget>();
function openBudget(budget?: Budget) {
  editingBudget.value = budget;
  budgetModalOpen.value = true;
}
const copyModalOpen = ref(false);
</script>

<template>
  <div>
    <PageHeader title="My Plan">
      <template #trailing>
        <WalletPicker />
      </template>
    </PageHeader>

    <div class="px-4">
      <!-- Goals -->
      <section>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Goals</h2>
          <UButton label="New goal" icon="i-lucide-plus" color="neutral" variant="soft" size="lg" class="h-11 px-4" @click="newGoal" />
        </div>

        <button
          v-if="!goalCards.length"
          type="button"
          class="mt-3 flex w-full items-center gap-4 rounded-2xl border border-dashed border-accented px-4 py-4 text-left transition-colors hover:bg-muted"
          @click="newGoal"
        >
          <IconTile icon="i-lucide-piggy-bank" />
          <span class="min-w-0">
            <span class="block font-display font-semibold text-highlighted">Save toward something</span>
            <span class="mt-0.5 block text-sm text-muted">A trip, a car, a safety net. Set a target and track it here.</span>
          </span>
        </button>

        <ul v-else class="mt-3 space-y-3">
          <li v-for="g in goalCards" :key="g.goal.id" class="surface-card overflow-hidden rounded-2xl">
            <div class="p-4">
              <div class="flex items-start gap-3">
                <IconTile :icon="g.icon" :color="g.color" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-display font-bold tracking-tight text-highlighted">{{ g.name }}</p>
                  <p class="text-sm text-muted tabular-nums">
                    {{ g.goal.deadline ? `Due ${formatDate(g.goal.deadline)}` : "No due date" }}
                  </p>
                </div>
                <UDropdownMenu :items="goalMenu(g)" :content="{ align: 'end' }">
                  <UButton
                    icon="i-lucide-ellipsis-vertical"
                    color="neutral"
                    variant="ghost"
                    :aria-label="`${g.name} options`"
                    class="-mt-1 -mr-2"
                  />
                </UDropdownMenu>
              </div>

              <!-- Wraps instead of cutting long amounts (e.g. LAK) short -->
              <div class="mt-4 flex flex-wrap items-baseline gap-x-2">
                <p class="font-display text-2xl font-bold tracking-tight break-all text-highlighted tabular-nums">
                  {{ formatAmount(g.saved, g.goal.currency) }}
                </p>
                <p class="shrink-0 text-sm text-muted tabular-nums">of {{ formatAmount(g.goal.target, g.goal.currency) }}</p>
                <span class="ml-auto shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-muted">
                  {{ g.goal.currency }}
                </span>
              </div>

              <!-- Progress bar with a knob at the saved amount -->
              <div
                class="relative mt-4 h-3 rounded-full"
                :style="barTrack(g.color)"
                role="progressbar"
                :aria-valuenow="Math.round(g.progress * 100)"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`${g.name} progress`"
              >
                <div class="absolute inset-y-0 rounded-r-full" :style="barBehind(g.color, g.progress, g.behind)" />
                <div
                  class="bar-grow relative h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  :style="barFill(g.color, g.progress)"
                >
                  <span
                    v-if="g.progress > 0 && g.progress < 1"
                    class="absolute top-1/2 right-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white shadow-md"
                    :style="{ borderColor: `var(--ui-${g.color})` }"
                  />
                </div>
              </div>

              <div class="mt-3 flex items-center justify-between gap-3 text-sm">
                <p class="text-muted">
                  Your progress
                  <span class="font-medium text-toned tabular-nums">{{ Math.floor(g.progress * 100) }}%</span>
                </p>
                <p v-if="g.left" class="font-medium text-highlighted tabular-nums">
                  {{ formatAmount(g.left, g.goal.currency) }} left
                </p>
              </div>

              <!-- Add money tinted in the goal's color (the card's main action), take out as a quiet round button -->
              <div v-if="g.left" class="mt-4 flex gap-2">
                <button
                  type="button"
                  class="flex h-12 flex-1 items-center justify-center rounded-full font-semibold text-highlighted transition-[transform,filter] hover:brightness-110 active:scale-[0.98] motion-reduce:active:scale-100"
                  :style="addMoneyStyle(g.color)"
                  @click="openMoney(g, 'add')"
                >
                  Add money
                </button>
                <button
                  v-if="g.saved > 0"
                  type="button"
                  :aria-label="`Take money out of ${g.name}`"
                  class="flex size-12 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-[transform,color] hover:text-toned active:scale-95 motion-reduce:active:scale-100"
                  @click="openMoney(g, 'take')"
                >
                  <UIcon name="i-lucide-minus" class="size-5" />
                </button>
              </div>
            </div>

            <p
              v-if="g.status"
              class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
              :class="statusClass[g.status.tone]"
            >
              <UIcon :name="g.status.icon" class="size-4 shrink-0" />
              {{ g.status.text }}
            </p>
          </li>
        </ul>
      </section>

      <!-- Budgets: month by month -->
      <section class="mt-8">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Budgets</h2>
          <MonthPicker v-model="pickedMonth" />
        </div>

        <!-- A month without budgets: reuse the last month's, or start fresh -->
        <div v-if="!budgetCards.length" class="mt-3 space-y-3">
          <button
            v-if="previous"
            type="button"
            class="surface-card flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
            @click="copyModalOpen = true"
          >
            <IconTile icon="i-lucide-copy" />
            <span class="min-w-0 flex-1">
              <span class="block font-display font-semibold text-highlighted">Use budgets from {{ previous.label }}</span>
              <span class="mt-0.5 block text-sm text-muted">
                Pick which of the {{ previous.budgets.length }} to keep for this month.
              </span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-4 rounded-2xl border border-dashed border-accented px-4 py-4 text-left transition-colors hover:bg-muted"
            @click="openBudget()"
          >
            <IconTile icon="i-lucide-gauge" color="secondary" />
            <span class="min-w-0">
              <span class="block font-display font-semibold text-highlighted">
                {{ previous ? "Start fresh" : "Set a monthly limit" }}
              </span>
              <span class="mt-0.5 block text-sm text-muted">Pick one or more categories and see how much is left as you spend.</span>
            </span>
          </button>
        </div>

        <template v-else>
          <div class="mt-2 flex items-center justify-between gap-3">
            <p class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm text-muted">
              Spent
              <span class="font-display text-base font-semibold text-highlighted tabular-nums">
                {{ formatAmount(budgetSpent, currency) }}
              </span>
              of {{ formatAmount(budgetTotal, currency) }}
              <span class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-muted">{{ currency }}</span>
            </p>
            <UButton label="New budget" icon="i-lucide-plus" color="neutral" variant="soft" size="lg" class="h-11 shrink-0 px-4" @click="openBudget()" />
          </div>

          <ul class="mt-3 space-y-3">
            <li v-for="b in budgetCards" :key="b.budget.id">
              <button
                type="button"
                class="surface-card w-full rounded-2xl p-4 text-left transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
                :aria-label="`Edit ${b.name} budget`"
                @click="openBudget(b.budget)"
              >
                <div class="flex items-center gap-3">
                  <!-- First category's tile; several categories add a "+N" badge on its corner
                       (the name already lists them all) -->
                  <div class="relative shrink-0">
                    <IconTile :icon="b.tiles[0]?.icon ?? 'i-lucide-tag'" :color="b.tiles[0]?.color" size="sm" />
                    <span
                      v-if="b.tiles.length > 1"
                      class="absolute -right-1.5 -bottom-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accented px-1 text-[11px] font-semibold text-highlighted tabular-nums ring-2 ring-[#161b28]"
                      :aria-label="`${b.tiles.length} categories`"
                    >+{{ b.tiles.length - 1 }}</span>
                  </div>
                  <p class="min-w-0 flex-1 truncate font-display font-bold tracking-tight text-highlighted">{{ b.name }}</p>
                </div>

                <!-- What's left is the number that matters; wraps instead of cutting long amounts -->
                <p class="mt-4 flex flex-wrap items-baseline gap-x-2">
                  <span
                    class="font-display text-2xl font-bold tracking-tight break-all tabular-nums"
                    :class="b.left < 0 ? 'text-error' : 'text-highlighted'"
                  >
                    {{ formatAmount(Math.abs(b.left), currency) }}
                  </span>
                  <span class="shrink-0 text-sm text-muted">{{ b.left < 0 ? "over budget" : "left" }}</span>
                </p>

                <div
                  class="mt-3 h-3 overflow-hidden rounded-full"
                  :style="barTrack(budgetColor(b))"
                  role="progressbar"
                  :aria-valuenow="Math.round(b.used * 100)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="`${b.name} spent`"
                >
                  <div
                    class="bar-grow h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    :style="barFill(budgetColor(b), Math.min(b.used, 1))"
                  />
                </div>

                <!-- Same layout as the goal cards: percent on the left, amounts on the right -->
                <div class="mt-3 flex items-center justify-between gap-3 text-sm text-muted tabular-nums">
                  <p>
                    Used
                    <span
                      class="font-medium"
                      :class="b.used > 1 ? 'text-error' : b.used >= 0.9 ? 'text-warning' : 'text-toned'"
                    >{{ Math.round(b.used * 100) }}%</span>
                  </p>
                  <p class="text-right">
                    <span class="font-medium text-toned">{{ formatAmount(b.spent, currency) }}</span>
                    of {{ formatAmount(b.budget.amount, currency) }}
                  </p>
                </div>
              </button>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <GoalModal v-model:open="goalModalOpen" :goal="editingGoal" :wallet="wallet" />
    <GoalMoneyModal
      v-model:open="moneyModalOpen"
      :goal="moneyCard?.goal"
      :category="moneyCard?.category"
      :saved="moneyCard?.saved ?? 0"
      :mode="moneyMode"
    />
    <BudgetModal
      v-if="wallet"
      v-model:open="budgetModalOpen"
      :budget="editingBudget"
      :month="pickedKey"
      :wallet="wallet"
    />
    <BudgetCopyModal
      v-if="previous && wallet"
      v-model:open="copyModalOpen"
      :from="previous.budgets"
      :from-label="previous.label"
      :month="pickedKey"
      :wallet="wallet"
    />
  </div>
</template>

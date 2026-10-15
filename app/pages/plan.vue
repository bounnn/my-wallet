<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";

// My Plan (ui/ref1, right screen): the picked wallet's savings goals with progress against their due date,
// then its budgets for the picked month as bars (each month starts empty; earlier budgets can be copied in)
useHead({ title: "My Plan" });

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

const now = new Date();

// --- Goals ---

// Unfinished goals first, oldest first within each group
const goalCards = computed(() =>
  (goals.value ?? [])
    .filter((g) => g.accountId === accountId.value)
    .map((g) => {
      const saved = goalSaved(g, transactions.value ?? []);
      return { goal: g, category: categoryById.value.get(g.categoryId), saved, done: saved >= g.target };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || a.goal.createdAt.getTime() - b.goal.createdAt.getTime()),
);
type GoalCardData = (typeof goalCards.value)[number];

const goalModalOpen = ref(false);
const moneyModalOpen = ref(false);
const editingGoal = shallowRef<Goal>();
// By id, so the modal's saved amount stays live
const moneyGoalId = ref<number>();
const moneyCard = computed(() => goalCards.value.find((c) => c.goal.id === moneyGoalId.value));
const moneyMode = ref<"add" | "take">("add");

function openGoal(goal?: Goal) {
  editingGoal.value = goal;
  goalModalOpen.value = true;
}
function openMoney(card: GoalCardData, mode: "add" | "take") {
  moneyGoalId.value = card.goal.id;
  moneyMode.value = mode;
  moneyModalOpen.value = true;
}

const toast = useToast();

// The goal's category is archived, not deleted, so its transactions keep their name; undo brings both back
async function removeGoal(card: GoalCardData) {
  const goal = card.goal;
  await deleteGoal(goal);
  toast.add({
    title: "Goal deleted",
    description: `${card.category?.name ?? "Goal"} transactions are kept`,
    icon: "i-lucide-trash-2",
    actions: [{ label: "Undo", color: "neutral", variant: "soft", onClick: () => void restoreGoal(goal) }],
  });
}

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

// The picked month's expenses in this wallet
const monthExpenses = computed(() => {
  const from = month.value;
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return (transactions.value ?? []).filter(
    (t) => t.type === "expense" && t.accountId === accountId.value && t.date >= from && t.date < to,
  );
});

const monthSpent = computed(() => {
  const spent = new Map<number, number>();
  for (const t of monthExpenses.value) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  return spent;
});

// Most used first, so the budgets running out sit on top
const budgetCards = computed(() =>
  monthBudgets.value
    .map((b) => {
      const categories = b.categoryIds.map((id) => categoryById.value.get(id));
      const tiles = categories.map((c) => ({ icon: c?.icon, color: c?.color }));
      const spent = b.categoryIds.reduce((s, id) => s + (monthSpent.value.get(id) ?? 0), 0);
      return {
        budget: b,
        tiles,
        name: b.name || categories.map((c) => c?.name ?? "Uncategorized").join(", "),
        color: tiles[0]?.color ?? DEFAULT_CATEGORY_COLOR,
        spent,
        used: b.amount ? spent / b.amount : 0,
      };
    })
    .sort((a, b) => b.used - a.used),
);

const budgetTotal = computed(() => budgetCards.value.reduce((s, b) => s + b.budget.amount, 0));
const budgetSpent = computed(() => budgetCards.value.reduce((s, b) => s + b.spent, 0));

const budgetModalOpen = ref(false);
const editingBudget = shallowRef<Budget>();
function openBudget(budget?: Budget) {
  editingBudget.value = budget;
  budgetModalOpen.value = true;
}

// Tapping a budget shows the month's spending behind it, newest first; editing is one tap further.
// By id, so the numbers stay live.
const detailsOpen = ref(false);
const detailsBudgetId = ref<number>();
const detailsCard = computed(() => budgetCards.value.find((c) => c.budget.id === detailsBudgetId.value));
const detailsItems = computed(() => {
  const b = detailsCard.value?.budget;
  if (!b) return [];
  return monthExpenses.value
    .filter((t) => b.categoryIds.includes(t.categoryId))
    .sort((x, y) => y.date.getTime() - x.date.getTime());
});
function openDetails(id: number) {
  detailsBudgetId.value = id;
  detailsOpen.value = true;
}
function editFromDetails() {
  const budget = detailsCard.value?.budget;
  detailsOpen.value = false;
  if (budget) openBudget(budget);
}
const copyModalOpen = ref(false);
</script>

<template>
  <div>
    <!-- Same header as home and report: with several wallets the picker takes the title's place -->
    <PageHeader :title="(wallets?.length ?? 0) > 1 ? undefined : 'My Plan'">
      <template #leading>
        <WalletPicker />
      </template>
    </PageHeader>

    <div class="px-4">
      <!-- Goals -->
      <section>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold tracking-tight text-highlighted">Goals</h2>
          <UButton label="New goal" icon="i-lucide-plus" color="neutral" variant="soft" size="lg" class="h-11 px-4" @click="openGoal()" />
        </div>

        <button
          v-if="!goalCards.length"
          type="button"
          class="mt-3 flex w-full items-center gap-4 rounded-2xl border border-dashed border-accented px-4 py-4 text-left transition-colors hover:bg-muted"
          @click="openGoal()"
        >
          <IconTile icon="i-lucide-piggy-bank" />
          <span class="min-w-0">
            <span class="block font-display font-semibold text-highlighted">Save toward something</span>
            <span class="mt-0.5 block text-sm text-muted">A trip, a car, a safety net. Set a target and track it here.</span>
          </span>
        </button>

        <ul v-else class="mt-3 space-y-3">
          <li v-for="g in goalCards" :key="g.goal.id">
            <GoalCard
              :goal="g.goal"
              :category="g.category"
              :saved="g.saved"
              @add="openMoney(g, 'add')"
              @take="openMoney(g, 'take')"
              @edit="openGoal(g.goal)"
              @delete="removeGoal(g)"
            />
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
              <BudgetCard
                :name="b.name"
                :tiles="b.tiles"
                :spent="b.spent"
                :amount="b.budget.amount"
                :currency="currency"
                @open="openDetails(b.budget.id)"
              />
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
    <BudgetDetailsModal
      v-model:open="detailsOpen"
      :name="detailsCard?.name ?? ''"
      :spent="detailsCard?.spent ?? 0"
      :amount="detailsCard?.budget.amount ?? 0"
      :color="detailsCard?.color"
      :currency="currency"
      :items="detailsItems"
      :category-by-id="categoryById"
      @edit="editFromDetails"
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

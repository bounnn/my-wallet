<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

// Create a budget in `wallet` for `month` ("YYYY-MM") covering one or more expense categories, or edit / remove one
// when `budget` is given
const props = defineProps<{ budget?: Budget; month: string; wallet: Account }>();
const currency = computed(() => props.wallet.currency);
const open = defineModel<boolean>("open", { required: true });

const { value: categories } = useLiveQuery(() => db.categories.where("type").equals("expense").toArray(), []);
const { value: budgets } = useLiveQuery(
  () => db.budgets.where("month").equals(props.month).toArray(),
  [],
  () => props.month,
);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);

// A category is in at most one of the wallet's budgets a month, so only offer the free ones (plus this budget's own).
// Goals' categories are savings, not spending, so they're left out.
const choices = computed(() => {
  const taken = new Set(
    (budgets.value ?? [])
      .filter((b) => b.accountId === props.wallet.id && b.id !== props.budget?.id)
      .flatMap((b) => b.categoryIds),
  );
  const goalCategories = new Set((goals.value ?? []).map((g) => g.categoryId));
  return (categories.value ?? []).filter((c) => !c.archived && !taken.has(c.id) && !goalCategories.has(c.id));
});

const state = reactive({ categoryIds: [] as number[], name: "", amount: "" });
const picked = computed(() => choices.value.filter((c) => state.categoryIds.includes(c.id)));
const monthLabel = computed(() => {
  const [year, month] = props.month.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(year!, month! - 1, 1));
});
// Shown on the card when no name is given
const defaultName = computed(() => picked.value.map((c) => c.name).join(", "));

watch(open, (isOpen) => {
  if (!isOpen) return;
  state.categoryIds = [...(props.budget?.categoryIds ?? [])];
  state.name = props.budget?.name ?? "";
  state.amount = props.budget ? formatAmount(props.budget.amount, currency.value) : "";
});

// The tiles aren't form inputs, so picking one clears the "pick a category" error by hand
const form = useTemplateRef("form");
function toggle(id: number) {
  state.categoryIds = state.categoryIds.includes(id)
    ? state.categoryIds.filter((c) => c !== id)
    : [...state.categoryIds, id];
  form.value?.clear("categoryIds");
}

const schema = v.object({
  // Keep the picker's order, and drop ids that are no longer offered
  categoryIds: v.pipe(
    v.array(v.number()),
    v.transform(() => picked.value.map((c) => c.id)),
    v.minLength(1, "Pick at least one category"),
  ),
  name: v.pipe(v.string(), v.trim(), v.maxLength(30, "Keep it under 30 characters")),
  amount: v.pipe(
    v.string(),
    v.transform((text) => parseAmount(text, currency.value)),
    v.check((n: number) => Number.isFinite(n), "Enter a number"),
    v.minValue(1, "Enter a limit above 0"),
  ),
});

const toast = useToast();

async function save({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  // A name only matters for several categories; one category is named after itself
  const fields = { ...data, name: (data.categoryIds.length > 1 && data.name) || undefined };
  try {
    if (props.budget) await updateBudget(props.budget, fields);
    else await addBudget(props.wallet.id, props.month, fields);
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the budget",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}

// Removing is easy to undo from the toast
async function remove() {
  const budget = props.budget;
  if (!budget) return;
  await deleteBudget(budget);
  open.value = false;
  toast.add({
    title: "Budget removed",
    description: budget.name || defaultName.value,
    icon: "i-lucide-trash-2",
    actions: [{ label: "Undo", color: "neutral", variant: "soft", onClick: () => void restoreBudget(budget) }],
  });
}
</script>

<template>
  <UModal v-model:open="open" :title="budget ? 'Edit budget' : 'New budget'">
    <template #body>
      <UForm ref="form" :schema="schema" :state="state" class="space-y-5" @submit="save">
        <!-- Grouped card like the add screen: limit first; a name only for several categories (optional) -->
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <AmountField v-model="state.amount" name="amount" :label="`Limit for ${monthLabel}`" :currency="currency" />
          <FieldRow
            v-if="picked.length > 1"
            v-model="state.name"
            name="name"
            label="Name"
            :placeholder="defaultName"
            :maxlength="30"
          />
        </div>

        <!-- Categories: tap to add or remove; several share one limit -->
        <UFormField name="categoryIds" :ui="{ error: 'sr-only' }">
          <template #default="{ error }">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm" :class="error ? 'text-error' : 'text-muted'">
                {{ error || "Categories" }}
              </p>
              <span v-if="picked.length" class="rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-toned tabular-nums">
                {{ picked.length }} picked
              </span>
            </div>
            <p v-if="!choices.length" class="mt-2 rounded-2xl bg-elevated px-4 py-5 text-center text-sm text-muted">
              Every expense category already has a budget this month
            </p>
            <div v-else class="-mx-2 mt-1 grid max-h-[40dvh] grid-cols-4 gap-1 overflow-y-auto" role="group" aria-label="Categories">
              <button
                v-for="c in choices"
                :key="c.id"
                type="button"
                role="checkbox"
                :aria-checked="state.categoryIds.includes(c.id)"
                class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors"
                :class="state.categoryIds.includes(c.id) ? 'bg-elevated' : 'hover:bg-elevated/50'"
                @click="toggle(c.id)"
              >
                <span class="relative">
                  <IconTile :icon="c.icon ?? 'i-lucide-tag'" :color="c.color" />
                  <span
                    v-if="state.categoryIds.includes(c.id)"
                    class="btn-primary-gradient absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-(--ui-bg-elevated)"
                  >
                    <UIcon name="i-lucide-check" class="size-3" />
                  </span>
                </span>
                <span
                  class="w-full truncate text-center text-xs font-medium"
                  :class="state.categoryIds.includes(c.id) ? 'text-highlighted' : 'text-muted'"
                >{{ c.name }}</span>
              </button>
            </div>
          </template>
        </UFormField>

        <div class="flex gap-2">
          <UButton
            v-if="budget"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            aria-label="Remove budget"
            class="size-13 justify-center bg-elevated text-error"
            @click="remove"
          />
          <UButton
            type="submit"
            :label="budget ? 'Save budget' : 'Add budget'"
            size="xl"
            block
            loading-auto
            :disabled="!budget && !choices.length"
            class="h-13 flex-1 justify-center"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

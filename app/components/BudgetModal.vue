<script setup lang="ts">
import * as v from "valibot";

// Create a budget in `wallet` for `month` ("YYYY-MM") covering one or more expense categories, or edit / remove one
// when `budget` is given
const props = defineProps<{ budget?: Budget; month: string; wallet: Account }>();
const currency = computed(() => props.wallet.currency);
const open = defineModel<boolean>("open", { required: true });

const { value: categories } = useLiveQuery(() => db.categories.where("type").equals("expense").toArray(), []);
const { value: budgets } = useLiveQuery(() => db.budgets.where("month").equals(props.month).toArray(), []);
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

const categoryIds = ref<number[]>([]);
const name = ref("");
const amountText = ref("");
const errors = ref<{ categoryIds?: string; name?: string; amount?: string }>({});
const picked = computed(() => choices.value.filter((c) => categoryIds.value.includes(c.id)));
const monthLabel = computed(() => {
  const [year, month] = props.month.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(year!, month! - 1, 1));
});
// Shown on the card when no name is given
const defaultName = computed(() => picked.value.map((c) => c.name).join(", "));

watch(open, (isOpen) => {
  if (!isOpen) return;
  categoryIds.value = [...(props.budget?.categoryIds ?? [])];
  name.value = props.budget?.name ?? "";
  amountText.value = props.budget ? formatAmount(props.budget.amount, currency.value) : "";
  errors.value = {};
});

function toggle(id: number) {
  categoryIds.value = categoryIds.value.includes(id)
    ? categoryIds.value.filter((c) => c !== id)
    : [...categoryIds.value, id];
  errors.value.categoryIds = undefined;
}

const schema = v.object({
  categoryIds: v.pipe(v.array(v.number()), v.minLength(1, "Pick at least one category")),
  name: v.pipe(v.string(), v.trim(), v.maxLength(30, "Keep it under 30 characters")),
  amount: v.pipe(v.number(), v.check(Number.isFinite, "Enter a number"), v.minValue(1, "Enter a limit above 0")),
});

const saving = ref(false);
const toast = useToast();

async function save() {
  const result = v.safeParse(schema, {
    // Keep the picker's order, and drop ids that are no longer offered
    categoryIds: picked.value.map((c) => c.id),
    // A name only matters for several categories; one category is named after itself
    name: picked.value.length > 1 ? name.value : "",
    amount: parseAmount(amountText.value, currency.value),
  });
  if (!result.success) {
    const nested = v.flatten<typeof schema>(result.issues).nested ?? {};
    errors.value = { categoryIds: nested.categoryIds?.[0], name: nested.name?.[0], amount: nested.amount?.[0] };
    return;
  }

  const fields = { ...result.output, name: result.output.name || undefined };
  saving.value = true;
  try {
    if (props.budget) await db.budgets.update(props.budget.id, fields);
    else await db.budgets.add({ ...fields, accountId: props.wallet.id, month: props.month, createdAt: new Date() });
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the budget",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}

// Removing is easy to undo from the toast
async function remove() {
  const budget = props.budget;
  if (!budget) return;
  await db.budgets.delete(budget.id);
  open.value = false;
  toast.add({
    title: "Budget removed",
    description: budget.name || defaultName.value,
    icon: "i-lucide-trash-2",
    actions: [{ label: "Undo", color: "neutral", variant: "soft", onClick: () => void db.budgets.add(budget) }],
  });
}
</script>

<template>
  <UModal v-model:open="open" :title="budget ? 'Edit budget' : 'New budget'">
    <template #body>
      <form class="space-y-5" @submit.prevent="save">
        <!-- Grouped card like the add screen: limit first; a name only for several categories (optional) -->
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <AmountField
            v-model="amountText"
            :label="`Limit for ${monthLabel}`"
            :currency="currency"
            :error="errors.amount"
            @update:model-value="errors.amount = undefined"
          />
          <label v-if="picked.length > 1" class="flex min-h-12 items-center gap-3 px-4 py-3">
            <UIcon name="i-lucide-pen-line" class="size-5 shrink-0 text-dimmed" />
            <span class="min-w-0 flex-1">
              <span class="block text-xs" :class="errors.name ? 'text-error' : 'text-muted'">{{ errors.name ?? "Name" }}</span>
              <input
                v-model="name"
                :placeholder="defaultName"
                maxlength="30"
                autocomplete="off"
                enterkeyhint="done"
                aria-label="Budget name"
                :aria-invalid="!!errors.name"
                class="w-full truncate bg-transparent font-medium text-highlighted caret-primary outline-none placeholder:text-dimmed"
                @input="errors.name = undefined"
              />
            </span>
          </label>
        </div>

        <!-- Categories: tap to add or remove; several share one limit -->
        <div>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm" :class="errors.categoryIds ? 'text-error' : 'text-muted'">
              {{ errors.categoryIds ?? "Categories" }}
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
              :aria-checked="categoryIds.includes(c.id)"
              class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors"
              :class="categoryIds.includes(c.id) ? 'bg-elevated' : 'hover:bg-elevated/50'"
              @click="toggle(c.id)"
            >
              <span class="relative">
                <IconTile :icon="c.icon ?? 'i-lucide-tag'" :color="c.color" />
                <span
                  v-if="categoryIds.includes(c.id)"
                  class="btn-primary-gradient absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-(--ui-bg-elevated)"
                >
                  <UIcon name="i-lucide-check" class="size-3" />
                </span>
              </span>
              <span
                class="w-full truncate text-center text-xs font-medium"
                :class="categoryIds.includes(c.id) ? 'text-highlighted' : 'text-muted'"
              >{{ c.name }}</span>
            </button>
          </div>
        </div>


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
            :loading="saving"
            :disabled="!budget && !choices.length"
            class="h-13 flex-1 justify-center"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>

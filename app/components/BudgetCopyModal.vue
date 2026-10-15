<script setup lang="ts">
// Copy a wallet's budgets from an earlier month into `month`: all ticked to start, untick the ones not wanted.
// Categories that already have one of the wallet's budgets in `month` (or were archived) are left out of the copies.
const props = defineProps<{ from: Budget[]; fromLabel: string; month: string; wallet: Account }>();
const currency = computed(() => props.wallet.currency);
const open = defineModel<boolean>("open", { required: true });

const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: monthBudgets } = useLiveQuery(
  () => db.budgets.where("month").equals(props.month).toArray(),
  [],
  () => props.month,
);
const categoryById = computed(() => new Map((categories.value ?? []).map((c) => [c.id, c])));

const rows = computed(() => {
  const taken = new Set(
    (monthBudgets.value ?? []).filter((b) => b.accountId === props.wallet.id).flatMap((b) => b.categoryIds),
  );
  return props.from
    .map((b) => {
      const categoryIds = b.categoryIds.filter((id) => !taken.has(id) && !categoryById.value.get(id)?.archived);
      const tiles = categoryIds.map((id) => categoryById.value.get(id)).filter((c) => !!c);
      return { budget: b, categoryIds, tiles, name: b.name || tiles.map((c) => c.name).join(", ") };
    })
    .filter((r) => r.categoryIds.length);
});

const picked = ref<number[]>([]);
watch(open, (isOpen) => isOpen && (picked.value = rows.value.map((r) => r.budget.id)));

function toggle(id: number) {
  picked.value = picked.value.includes(id) ? picked.value.filter((p) => p !== id) : [...picked.value, id];
}

const saving = ref(false);
const toast = useToast();

async function copy() {
  const copies = rows.value
    .filter((r) => picked.value.includes(r.budget.id))
    .map((r) => ({ name: r.budget.name, categoryIds: r.categoryIds, amount: r.budget.amount }));
  if (!copies.length) return;

  saving.value = true;
  try {
    await copyBudgets(props.wallet.id, props.month, copies);
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't copy the budgets",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Budgets from ${fromLabel}`">
    <template #body>
      <p class="text-sm text-muted">Pick the ones to use again. You can change their limits after.</p>

      <ul class="mt-4 max-h-[50dvh] divide-y divide-default overflow-y-auto rounded-2xl bg-elevated" role="group" :aria-label="`Budgets from ${fromLabel}`">
        <li v-for="r in rows" :key="r.budget.id">
          <button
            type="button"
            role="checkbox"
            :aria-checked="picked.includes(r.budget.id)"
            class="flex w-full items-center gap-3 px-4 py-3 text-left"
            @click="toggle(r.budget.id)"
          >
            <IconTile :icon="r.tiles[0]?.icon ?? 'i-lucide-tag'" :color="r.tiles[0]?.color" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ r.name }}</span>
              <span class="block text-sm text-muted tabular-nums">{{ formatAmount(r.budget.amount, currency) }}</span>
            </span>
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
              :class="picked.includes(r.budget.id) ? 'btn-primary-gradient text-white' : 'border-2 border-accented'"
            >
              <UIcon v-if="picked.includes(r.budget.id)" name="i-lucide-check" class="size-3.5" />
            </span>
          </button>
        </li>
      </ul>

      <UButton
        :label="picked.length ? `Use ${picked.length} ${picked.length === 1 ? 'budget' : 'budgets'}` : 'Pick a budget'"
        size="xl"
        block
        :loading="saving"
        :disabled="!picked.length"
        class="mt-5 h-13 justify-center"
        @click="copy"
      />
    </template>
  </UModal>
</template>

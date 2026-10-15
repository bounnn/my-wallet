<script setup lang="ts">
// Pick a category for the given type, or create a new one (which is then picked).
// Categories are shared by all wallets, except a goal's, which only shows for the goal's wallet (`accountId`).
const props = defineProps<{ type: Category["type"]; accountId?: number; selectedId?: number }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ select: [id: number] }>();

const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);
const { value: goals } = useLiveQuery(() => db.goals.toArray(), []);
// This wallet's goals' categories are included (adding an expense there saves toward the goal); deleted goals' are not
const otherWalletGoals = computed(
  () => new Set((goals.value ?? []).filter((g) => g.accountId !== props.accountId).map((g) => g.categoryId)),
);
const typeCategories = computed(() =>
  (categories.value ?? []).filter((c) => c.type === props.type && !c.archived && !otherWalletGoals.value.has(c.id)),
);

const view = ref<"pick" | "new">("pick");
watch(open, (isOpen) => isOpen && (view.value = "pick"));

// Picking, or creating one in the "New" view, closes the modal
function pick(id: number) {
  emit("select", id);
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="view === 'pick' ? 'Category' : 'New category'">
    <template #header="{ close }">
      <UButton
        v-if="view === 'new'"
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back to categories"
        class="-ml-2"
        @click="view = 'pick'"
      />
      <h2 class="flex-1 font-display text-lg font-semibold tracking-tight text-highlighted">
        {{ view === "pick" ? (type === "income" ? "Income category" : "Expense category") : "New category" }}
      </h2>
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Close" class="-mr-2" @click="close" />
    </template>

    <template #body>
      <!-- Pick: all categories for this type, plus "New" -->
      <div v-if="view === 'pick'" class="-mx-2 grid max-h-[60dvh] grid-cols-4 gap-1 overflow-y-auto" role="radiogroup" aria-label="Category">
        <button
          v-for="c in typeCategories"
          :key="c.id"
          type="button"
          role="radio"
          :aria-checked="c.id === selectedId"
          class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors"
          :class="c.id === selectedId ? 'bg-elevated' : 'hover:bg-elevated/50'"
          @click="pick(c.id)"
        >
          <IconTile :icon="c.icon ?? 'i-lucide-tag'" :color="c.color" />
          <span
            class="w-full truncate text-center text-xs font-medium"
            :class="c.id === selectedId ? 'text-highlighted' : 'text-muted'"
          >{{ c.name }}</span>
        </button>
        <button
          type="button"
          class="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors hover:bg-elevated/50"
          @click="view = 'new'"
        >
          <span class="flex size-12 items-center justify-center rounded-2xl border border-dashed border-accented text-muted">
            <UIcon name="i-lucide-plus" class="size-6" />
          </span>
          <span class="w-full truncate text-center text-xs font-medium text-muted">New</span>
        </button>
      </div>

      <!-- New: name, icon, color with a live preview -->
      <CategoryForm v-else :type="type" autofocus @saved="pick" />
    </template>
  </UModal>
</template>

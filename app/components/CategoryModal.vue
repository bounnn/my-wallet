<script setup lang="ts">
import * as v from "valibot";

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

function pick(id: number) {
  emit("select", id);
  open.value = false;
}

// --- New category ---
const icons = categoryIcons;

const name = ref("");
const icon = ref(icons[0]!);
const color = ref<CategoryColor>(DEFAULT_CATEGORY_COLOR);
const nameError = ref<string>();
const saving = ref(false);
const toast = useToast();

function startNew() {
  name.value = "";
  icon.value = icons[0]!;
  color.value = DEFAULT_CATEGORY_COLOR;
  nameError.value = undefined;
  view.value = "new";
}

const nameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Give the category a name"),
  v.maxLength(30, "Keep it under 30 characters"),
  v.check(
    (n) => !typeCategories.value.some((c) => c.name.toLowerCase() === n.toLowerCase()),
    "You already have this category",
  ),
);

async function create() {
  const result = v.safeParse(nameSchema, name.value);
  nameError.value = result.success ? undefined : result.issues[0].message;
  if (!result.success) return;

  saving.value = true;
  try {
    const id = await db.categories.add({ name: result.output, type: props.type, icon: icon.value, color: color.value });
    pick(id);
  } catch (error) {
    toast.add({
      title: "Couldn't add the category",
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
          @click="startNew"
        >
          <span class="flex size-12 items-center justify-center rounded-2xl border border-dashed border-accented text-muted">
            <UIcon name="i-lucide-plus" class="size-6" />
          </span>
          <span class="w-full truncate text-center text-xs font-medium text-muted">New</span>
        </button>
      </div>

      <!-- New: name, icon, color with a live preview -->
      <form v-else class="space-y-5" @submit.prevent="create">
        <div class="flex items-center gap-3">
          <IconTile :icon="icon" :color="color" />
          <div class="min-w-0 flex-1">
            <UInput
              v-model="name"
              placeholder="Category name"
              maxlength="30"
              autofocus
              autocomplete="off"
              enterkeyhint="done"
              aria-label="Category name"
              :aria-invalid="!!nameError"
              size="lg"
              class="w-full"
              @update:model-value="nameError = undefined"
            />
          </div>
        </div>
        <p v-if="nameError" class="-mt-3 text-sm text-error">{{ nameError }}</p>

        <div>
          <p class="text-sm text-muted">Icon</p>
          <div class="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Icon">
            <button
              v-for="i in icons"
              :key="i"
              type="button"
              role="radio"
              :aria-checked="i === icon"
              :aria-label="i.replace('i-lucide-', '').replaceAll('-', ' ')"
              class="flex aspect-square items-center justify-center rounded-xl transition-colors"
              :class="i === icon ? 'bg-primary/20 text-navy-100' : 'text-muted hover:bg-elevated'"
              @click="icon = i"
            >
              <UIcon :name="i" class="size-5" />
            </button>
          </div>
        </div>

        <div>
          <p class="text-sm text-muted">Color</p>
          <ColorPicker v-model="color" />
        </div>

        <UButton type="submit" label="Add category" size="xl" block :loading="saving" class="h-13 justify-center" />
      </form>
    </template>
  </UModal>
</template>

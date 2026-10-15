<script setup lang="ts">
import * as v from "valibot";

// Create a category of `type`, or edit / delete one when `category` is given: name, icon, color
const props = defineProps<{ category?: Category; type: Category["type"] }>();
const open = defineModel<boolean>("open", { required: true });

const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

const name = ref("");
const icon = ref(categoryIcons[0]!);
const color = ref<CategoryColor>(DEFAULT_CATEGORY_COLOR);
const nameError = ref<string>();
const saving = ref(false);
const toast = useToast();

// Fill the form each time it opens: the category's values, or a blank one
watch(open, (isOpen) => {
  if (!isOpen) return;
  name.value = props.category?.name ?? "";
  icon.value = props.category?.icon ?? categoryIcons[0]!;
  color.value = props.category?.color ?? DEFAULT_CATEGORY_COLOR;
  nameError.value = undefined;
});

// Keep the category's own icon on offer even when it isn't in the list (starter "Other" uses ellipsis)
const icons = computed(() =>
  props.category?.icon && !categoryIcons.includes(props.category.icon)
    ? [props.category.icon, ...categoryIcons]
    : categoryIcons,
);

const nameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Give the category a name"),
  v.maxLength(30, "Keep it under 30 characters"),
  v.check(
    (n) =>
      !(categories.value ?? []).some(
        (c) =>
          c.type === props.type &&
          !c.archived &&
          c.id !== props.category?.id &&
          c.name.toLowerCase() === n.toLowerCase(),
      ),
    "You already have this category",
  ),
);

async function save() {
  const result = v.safeParse(nameSchema, name.value);
  nameError.value = result.success ? undefined : result.issues[0].message;
  if (!result.success) return;

  const fields = { name: result.output, icon: icon.value, color: color.value };
  saving.value = true;
  try {
    if (props.category) await db.categories.update(props.category.id, fields);
    else await db.categories.add({ ...fields, type: props.type });
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the category",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  } finally {
    saving.value = false;
  }
}

// A category with transactions or budgets is archived so they keep its name; an unused one is deleted.
// Either way the toast can undo it.
async function remove() {
  const category = props.category;
  if (!category) return;
  const used =
    (await db.transactions.where("categoryId").equals(category.id).count()) > 0 ||
    (await db.budgets.where("categoryIds").equals(category.id).count()) > 0;
  if (used) await db.categories.update(category.id, { archived: true });
  else await db.categories.delete(category.id);
  open.value = false;
  toast.add({
    title: "Category deleted",
    description: used ? `${category.name} transactions are kept` : category.name,
    icon: "i-lucide-trash-2",
    actions: [
      {
        label: "Undo",
        color: "neutral",
        variant: "soft",
        onClick: () =>
          void (used ? db.categories.update(category.id, { archived: false }) : db.categories.add(category)),
      },
    ],
  });
}
</script>

<template>
  <UModal v-model:open="open" :title="category ? 'Edit category' : type === 'income' ? 'New income category' : 'New expense category'">
    <template #body>
      <!-- Name, icon, color with a live preview -->
      <form class="space-y-5" @submit.prevent="save">
        <div class="flex items-center gap-3">
          <IconTile :icon="icon" :color="color" />
          <div class="min-w-0 flex-1">
            <UInput
              v-model="name"
              placeholder="Category name"
              maxlength="30"
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
          <div class="mt-2 grid max-h-[30dvh] grid-cols-6 gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Icon">
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

        <div class="flex gap-2">
          <UButton
            v-if="category"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            aria-label="Delete category"
            class="size-13 justify-center bg-elevated text-error"
            @click="remove"
          />
          <UButton
            type="submit"
            :label="category ? 'Save category' : 'Add category'"
            size="xl"
            block
            :loading="saving"
            class="h-13 flex-1 justify-center"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>

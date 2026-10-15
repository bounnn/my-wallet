<script setup lang="ts">
// Create a category of `type`, or edit / delete one when `category` is given: name, icon, color
const props = defineProps<{ category?: Category; type: Category["type"] }>();
const open = defineModel<boolean>("open", { required: true });

const toast = useToast();

// Archived when it has transactions or budgets, deleted otherwise; either way the toast can undo it
async function remove() {
  const category = props.category;
  if (!category) return;
  try {
    const archived = await deleteCategory(category);
    open.value = false;
    toast.add({
      title: "Category deleted",
      description: archived ? `${category.name} transactions are kept` : category.name,
      icon: "i-lucide-trash-2",
      actions: [
        {
          label: "Undo",
          color: "neutral",
          variant: "soft",
          onClick: () => void restoreCategory(category, archived),
        },
      ],
    });
  } catch (error) {
    toast.add({
      title: "Couldn't delete the category",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="category ? 'Edit category' : type === 'income' ? 'New income category' : 'New expense category'">
    <template #body>
      <CategoryForm :category="category" :type="type" @saved="open = false">
        <template v-if="category" #actions>
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="soft"
            size="xl"
            aria-label="Delete category"
            class="size-13 justify-center bg-elevated text-error"
            @click="remove"
          />
        </template>
      </CategoryForm>
    </template>
  </UModal>
</template>

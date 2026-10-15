<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

// Name, icon and color of a category of `type`, with a live preview. Adds a new one, or saves `category` when
// given, then emits its id. Used by the category picker's "New" view and the category editor in settings;
// the `actions` slot sits next to the submit button (the editor's delete).
const props = defineProps<{ category?: Category; type: Category["type"]; autofocus?: boolean }>();
const emit = defineEmits<{ saved: [id: number] }>();

const { value: categories } = useLiveQuery(() => db.categories.toArray(), []);

// Keep the category's own icon on offer even when it isn't in the list (starter "Other" uses ellipsis)
const icons =
  props.category?.icon && !categoryIcons.includes(props.category.icon)
    ? [props.category.icon, ...categoryIcons]
    : categoryIcons;

const state = reactive({
  name: props.category?.name ?? "",
  icon: props.category?.icon ?? categoryIcons[0]!,
  color: props.category?.color ?? DEFAULT_CATEGORY_COLOR,
});

const schema = v.object({
  name: v.pipe(
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
  ),
  icon: v.string(),
  color: v.picklist(categoryColorKeys),
});

const toast = useToast();

async function save({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  try {
    if (props.category) {
      await updateCategory(props.category.id, data);
      emit("saved", props.category.id);
    } else {
      emit("saved", await addCategory(props.type, data));
    }
  } catch (error) {
    toast.add({
      title: "Couldn't save the category",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="save">
    <div class="flex items-center gap-3">
      <IconTile :icon="state.icon" :color="state.color" />
      <UFormField name="name" class="min-w-0 flex-1">
        <UInput
          v-model="state.name"
          placeholder="Category name"
          :maxlength="30"
          :autofocus="autofocus"
          autocomplete="off"
          enterkeyhint="done"
          aria-label="Category name"
          size="lg"
          class="w-full"
        />
      </UFormField>
    </div>

    <div>
      <p class="text-sm text-muted">Icon</p>
      <div class="mt-2 grid max-h-[30dvh] grid-cols-6 gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Icon">
        <button
          v-for="i in icons"
          :key="i"
          type="button"
          role="radio"
          :aria-checked="i === state.icon"
          :aria-label="i.replace('i-lucide-', '').replaceAll('-', ' ')"
          class="flex aspect-square items-center justify-center rounded-xl transition-colors"
          :class="i === state.icon ? 'bg-primary/20 text-navy-100' : 'text-muted hover:bg-elevated'"
          @click="state.icon = i"
        >
          <UIcon :name="i" class="size-5" />
        </button>
      </div>
    </div>

    <div>
      <p class="text-sm text-muted">Color</p>
      <ColorPicker v-model="state.color" />
    </div>

    <div class="flex gap-2">
      <slot name="actions" />
      <UButton
        type="submit"
        :label="category ? 'Save category' : 'Add category'"
        size="xl"
        block
        loading-auto
        class="h-13 flex-1 justify-center"
      />
    </div>
  </UForm>
</template>

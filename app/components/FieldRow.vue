<script setup lang="ts">
// Text field as a row of a grouped card (bg-elevated, like the add screen): an icon, then a small label above the
// input. Goes inside a UForm; its validation error for `name` takes the label's place (screen readers get it from
// the field itself). The `leading` slot replaces the icon, e.g. with a live IconTile preview.
defineProps<{
  name: string;
  label: string;
  icon?: string;
  placeholder?: string;
  maxlength?: number;
  enterkeyhint?: "done" | "next";
}>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <UFormField :name="name" :ui="{ error: 'sr-only' }">
    <template #default="{ error }">
      <label class="flex min-h-12 items-center gap-3 px-4 py-3">
        <slot name="leading">
          <UIcon :name="icon ?? 'i-lucide-pen-line'" class="size-5 shrink-0 text-dimmed" />
        </slot>
        <span class="min-w-0 flex-1">
          <span class="block text-xs" :class="error ? 'text-error' : 'text-muted'" aria-hidden="true">
            {{ error || label }}
          </span>
          <UInput
            v-model="model"
            variant="none"
            :placeholder="placeholder"
            :maxlength="maxlength"
            autocomplete="off"
            :enterkeyhint="enterkeyhint ?? 'done'"
            :aria-label="label"
            class="w-full"
            :ui="{ base: 'truncate p-0 font-medium caret-primary ring-0' }"
          />
        </span>
      </label>
    </template>
  </UFormField>
</template>

<script setup lang="ts">
// Top of every tab page: big title on the left, actions (e.g. the month picker) on the right.
// Without a title the row keeps its height, so the actions sit in the same spot on every page;
// the `leading` slot can fill the title's place (home's wallet picker).
defineProps<{ title?: string }>();
</script>

<template>
  <header class="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-4">
    <h1 v-if="title" class="truncate font-display text-3xl font-bold tracking-tight text-highlighted">{{ title }}</h1>
    <div v-else class="flex h-9 min-w-0 items-center">
      <slot name="leading" />
    </div>
    <div class="flex items-center gap-2">
      <slot name="trailing" />
    </div>
  </header>
</template>

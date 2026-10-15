<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <header class="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-4">
    <h1 class="truncate font-display text-3xl font-bold tracking-tight text-highlighted">{{ title }}</h1>
    <div class="flex items-center gap-2">
      <slot name="trailing" />
    </div>
  </header>
</template>

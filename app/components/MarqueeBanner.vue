<script setup lang="ts">
// Full-width solid navy UBanner strip with one line of uppercase text scrolling sideways in a UMarquee,
// each copy followed by a " - " so the loop reads on.
defineProps<{ text: string }>();
</script>

<template>
  <UBanner
    color="primary"
    :ui="{
      root: 'z-auto',
      container: 'h-9 max-w-none px-0 sm:px-0 lg:px-0',
      left: 'hidden',
      right: 'hidden',
      center: 'w-full',
      title: 'w-full text-xs font-semibold tracking-wider text-white uppercase',
    }"
  >
    <template #title>
      <UMarquee :repeat="2" :overlay="false" aria-hidden="true" class="[--duration:14s] [--gap:--spacing(2)]">
        <span class="whitespace-nowrap">{{ text }}</span>
        <span>-</span>
      </UMarquee>
      <span class="sr-only">{{ text }}</span>
    </template>
  </UBanner>
</template>

<script setup lang="ts">
const emit = defineEmits<{ add: [] }>();

const tabs = [
  { label: "Home", icon: "i-lucide-house", to: "/" },
  { label: "Report", icon: "i-lucide-chart-column", to: "/report" },
  { label: "Plan", icon: "i-lucide-target", to: "/plan" },
  { label: "Settings", icon: "i-lucide-settings", to: "/settings" },
];

const route = useRoute();
</script>

<!-- Tab bar with a raised add button in the middle, as in ui/ref1.png -->
<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-default bg-muted/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
  >
    <div class="relative grid grid-cols-5 items-end px-2 pt-2 pb-1">
      <template v-for="(tab, i) in tabs" :key="tab.to">
        <!-- Leave the middle column for the add button -->
        <div v-if="i === 2" />
        <NuxtLink
          :to="tab.to"
          class="flex flex-col items-center gap-1 py-1.5 text-xs font-medium transition-colors"
          :class="route.path === tab.to ? 'text-highlighted' : 'text-dimmed'"
        >
          <UIcon :name="tab.icon" class="size-6" />
          {{ tab.label }}
        </NuxtLink>
      </template>

      <button
        type="button"
        aria-label="Add transaction"
        class="absolute left-1/2 -top-7 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-b from-navy-400 to-navy-600 text-white shadow-[0_8px_24px_-4px_rgb(69_101_232/0.6)] ring-4 ring-bg transition-transform active:scale-95"
        @click="emit('add')"
      >
        <UIcon name="i-lucide-plus" class="size-7" />
      </button>
    </div>
  </nav>
</template>

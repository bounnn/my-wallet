<script setup lang="ts">
const emit = defineEmits<{ add: [] }>();

// Icons follow common finance-app conventions; labels are kept for screen readers
const tabs = [
  { label: "Home", icon: "i-lucide-house", to: "/" },
  { label: "Report", icon: "i-lucide-chart-pie", to: "/report" },
  { label: "Plan", icon: "i-lucide-piggy-bank", to: "/plan" },
  { label: "Settings", icon: "i-lucide-settings", to: "/settings" },
];

const route = useRoute();
</script>

<!-- Floating dock (Navy Vault): plain bg-muted card, icon-only tiles of one shape; the active tab is
     navy tinted and the add button is the screen's one gradient action -->
<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
  >
    <div
      class="grid grid-cols-5 gap-1 rounded-2xl bg-muted/95 p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl"
    >
      <template v-for="(tab, i) in tabs" :key="tab.to">
        <button
          v-if="i === 2"
          type="button"
          aria-label="Add transaction"
          class="btn-primary-gradient flex h-12 items-center justify-center rounded-xl text-white transition-transform active:scale-95 motion-reduce:active:scale-100"
          @click="emit('add')"
        >
          <UIcon name="i-lucide-plus" class="size-6" />
        </button>

        <NuxtLink
          :to="tab.to"
          :aria-label="tab.label"
          :aria-current="route.path === tab.to ? 'page' : undefined"
          class="flex h-12 items-center justify-center rounded-xl transition-colors duration-200"
          :class="route.path === tab.to ? 'bg-primary/20 text-navy-100' : 'text-muted hover:bg-elevated hover:text-toned'"
        >
          <UIcon :name="tab.icon" class="size-6" />
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>

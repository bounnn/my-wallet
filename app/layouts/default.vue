<script setup lang="ts">
const toast = useToast();

// Placeholder until the add-transaction sheet is built
function onAdd() {
  toast.add({ title: "Adding transactions is coming next", icon: "i-lucide-construction" });
}
</script>

<template>
  <div class="pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <slot />
  </div>
  <BottomNav @add="onAdd" />
</template>

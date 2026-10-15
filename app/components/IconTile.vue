<script setup lang="ts">
// Rounded square with a tinted background, used for category / income / expense icons
const props = withDefaults(defineProps<{ icon: string; color?: CategoryColor; size?: "sm" | "md" }>(), {
  color: "primary",
  size: "md",
});

// Full class names so Tailwind can find them
const tints: Record<CategoryColor, string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
};
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center rounded-2xl"
    :class="[tints[props.color], props.size === 'sm' ? 'size-10' : 'size-12']"
  >
    <UIcon :name="props.icon" :class="props.size === 'sm' ? 'size-5' : 'size-6'" />
  </div>
</template>

<script setup lang="ts">
// Rounded square with a tinted background, used for category / income / expense icons
const props = withDefaults(defineProps<{ icon: string; color?: CategoryColor; size?: "xs" | "sm" | "md" }>(), {
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
const boxes = { xs: "size-7 rounded-lg", sm: "size-10 rounded-2xl", md: "size-12 rounded-2xl" };
const icons = { xs: "size-3.5", sm: "size-5", md: "size-6" };
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center"
    :class="[tints[props.color], boxes[props.size]]"
  >
    <UIcon :name="props.icon" :class="icons[props.size]" />
  </div>
</template>

<script setup lang="ts">
// Rounded square with a tinted background: a category's icon in its own color, or a UI icon in a status color
type StatusColor = "primary" | "secondary" | "success" | "info" | "warning" | "error";
const props = withDefaults(
  defineProps<{ icon: string; color?: CategoryColor | StatusColor; size?: "xs" | "sm" | "md" }>(),
  { color: "primary", size: "md" },
);

// Full class names so Tailwind can find them
const tints: Record<CategoryColor | StatusColor, string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  blue: "bg-cat-blue/15 text-cat-blue",
  sky: "bg-cat-sky/15 text-cat-sky",
  teal: "bg-cat-teal/15 text-cat-teal",
  green: "bg-cat-green/15 text-cat-green",
  lime: "bg-cat-lime/15 text-cat-lime",
  yellow: "bg-cat-yellow/15 text-cat-yellow",
  orange: "bg-cat-orange/15 text-cat-orange",
  red: "bg-cat-red/15 text-cat-red",
  pink: "bg-cat-pink/15 text-cat-pink",
  slate: "bg-cat-slate/15 text-cat-slate",
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

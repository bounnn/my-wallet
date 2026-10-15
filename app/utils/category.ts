import type { CategoryColor } from "./db";

// Icons offered when creating or editing a category
export const categoryIcons = [
  "i-lucide-utensils", "i-lucide-coffee", "i-lucide-shopping-basket", "i-lucide-shopping-bag",
  "i-lucide-shirt", "i-lucide-bus", "i-lucide-car", "i-lucide-fuel",
  "i-lucide-plane", "i-lucide-house", "i-lucide-zap", "i-lucide-wifi",
  "i-lucide-smartphone", "i-lucide-receipt", "i-lucide-heart-pulse", "i-lucide-pill",
  "i-lucide-graduation-cap", "i-lucide-dumbbell", "i-lucide-ticket", "i-lucide-gamepad-2",
  "i-lucide-gift", "i-lucide-baby", "i-lucide-paw-print", "i-lucide-briefcase",
  "i-lucide-store", "i-lucide-trending-up", "i-lucide-piggy-bank", "i-lucide-landmark",
  "i-lucide-wallet", "i-lucide-tag",
];

// Color picker dots; full class names so Tailwind can find them
export const colorSwatches: Record<CategoryColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
};

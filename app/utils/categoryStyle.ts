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

export const DEFAULT_CATEGORY_COLOR: CategoryColor = "blue";

// Color picker dots with a name for screen readers; full class names so Tailwind can find them
export const colorSwatches: Record<CategoryColor, { class: string; label: string }> = {
  blue: { class: "bg-cat-blue", label: "Blue" },
  sky: { class: "bg-cat-sky", label: "Sky blue" },
  teal: { class: "bg-cat-teal", label: "Teal" },
  green: { class: "bg-cat-green", label: "Green" },
  lime: { class: "bg-cat-lime", label: "Lime" },
  yellow: { class: "bg-cat-yellow", label: "Yellow" },
  orange: { class: "bg-cat-orange", label: "Orange" },
  red: { class: "bg-cat-red", label: "Red" },
  pink: { class: "bg-cat-pink", label: "Pink" },
  slate: { class: "bg-cat-slate", label: "Grey" },
};

// The category color as CSS, and a see-through mix of it for tracks and soft fills
export const colorVar = (color?: CategoryColor) => `var(--color-cat-${color ?? DEFAULT_CATEGORY_COLOR})`;
export const colorMix = (color: CategoryColor | undefined, percent: number) =>
  `color-mix(in oklab, ${colorVar(color)} ${percent}%, transparent)`;

// Progress bars in the category color (home, report, plan): faint tinted track, fill fading in from the left
export const barTrackStyle = (color?: CategoryColor) => ({ background: colorMix(color, 14) });
export const barFillStyle = (color: CategoryColor | undefined, share: number, min = 0) => ({
  width: `${Math.max(share * 100, min)}%`,
  background: `linear-gradient(90deg, ${colorMix(color, 45)}, ${colorVar(color)})`,
});

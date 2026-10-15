<script setup lang="ts">
// One budget on the plan page: what's left of the month's limit, a bar in the first category's color, and the
// spent / used numbers. Tapping it opens the month's spending behind it.
const props = defineProps<{ name: string; tiles: Pick<Category, "icon" | "color">[]; spent: number; amount: number; currency: string }>();
defineEmits<{ open: [] }>();

const used = computed(() => (props.amount ? props.spent / props.amount : 0));
const left = computed(() => props.amount - props.spent);
const leftText = computed(() => formatAmount(Math.abs(left.value), props.currency));
// The bar follows the first category's color
const color = computed(() => props.tiles[0]?.color ?? DEFAULT_CATEGORY_COLOR);

// The bar keeps the category color; a nearly used or overspent budget says so with an icon and words
const alert = computed(() =>
  used.value > 1
    ? { icon: "i-lucide-circle-alert", text: "Over budget", class: "text-error" }
    : used.value >= 0.9
      ? { icon: "i-lucide-triangle-alert", text: "Almost used up", class: "text-warning" }
      : undefined,
);
</script>

<template>
  <button
    type="button"
    class="surface-card w-full rounded-2xl p-4 text-left transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
    :aria-label="`${name} budget, see spending`"
    @click="$emit('open')"
  >
    <div class="flex items-center gap-3">
      <!-- First category's tile; several categories add a "+N" badge on its corner (the name already lists them all) -->
      <div class="relative shrink-0">
        <IconTile :icon="tiles[0]?.icon ?? 'i-lucide-tag'" :color="tiles[0]?.color" size="sm" />
        <span
          v-if="tiles.length > 1"
          class="absolute -right-1.5 -bottom-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accented px-1 text-[11px] font-semibold text-highlighted tabular-nums ring-2 ring-(--ui-bg-muted)"
          :aria-label="`${tiles.length} categories`"
        >+{{ tiles.length - 1 }}</span>
      </div>
      <p class="min-w-0 flex-1 truncate font-display font-bold tracking-tight text-highlighted">{{ name }}</p>
    </div>

    <!-- What's left is the number that matters; long amounts shrink and wrap before "left" -->
    <p class="mt-4 flex flex-wrap items-baseline gap-x-2">
      <span
        class="font-display font-bold tracking-tight tabular-nums"
        :class="[amountSizeClass(leftText), left < 0 ? 'text-error' : 'text-highlighted']"
      >
        {{ leftText }}
      </span>
      <span class="shrink-0 text-sm text-muted">{{ left < 0 ? "over budget" : "left" }}</span>
    </p>

    <div
      class="mt-3 h-3 overflow-hidden rounded-full"
      :style="barTrackStyle(color)"
      role="progressbar"
      :aria-valuenow="Math.round(used * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${name} spent`"
    >
      <div
        class="bar-grow h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
        :style="barFillStyle(color, Math.min(used, 1))"
      />
    </div>

    <!-- Same layout as the goal cards: percent on the left, amounts on the right.
         Nearly used / over budget is said in words with an icon, not by color alone -->
    <div class="mt-3 flex items-center justify-between gap-3 text-sm text-muted tabular-nums">
      <p v-if="alert" class="flex items-center gap-1.5 font-medium" :class="alert.class">
        <UIcon :name="alert.icon" class="size-4 shrink-0" />
        {{ alert.text }}, {{ Math.round(used * 100) }}%
      </p>
      <p v-else>
        Used
        <span class="font-medium text-toned">{{ Math.round(used * 100) }}%</span>
      </p>
      <p class="text-right">
        <span class="font-medium text-toned">{{ formatAmount(spent, currency) }}</span>
        of {{ formatAmount(amount, currency) }}
      </p>
    </div>
  </button>
</template>

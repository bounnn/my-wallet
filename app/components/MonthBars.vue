<script setup lang="ts">
// Last months side by side (single series): wide bars with their amount on top and the month below,
// a dashed average line, and a readout for the tapped month (the last one by default)
export interface MonthBar {
  key: string;
  // Short name under the bar ("Oct") and full name in the readout ("October 2026")
  label: string;
  title: string;
  total: number;
}

const props = defineProps<{
  items: MonthBar[];
  currency: string;
  color: "success" | "error";
  // Income going up is good, expenses going up is bad; sets the change chip color
  upIsGood: boolean;
  // Read out for the chart as a whole
  label: string;
}>();
const selected = defineModel<number | null>("selected", { default: null });

const active = computed(() => selected.value ?? props.items.length - 1);
const max = computed(() => Math.max(...props.items.map((i) => i.total), 0));
const average = computed(() =>
  props.items.length ? props.items.reduce((s, i) => s + i.total, 0) / props.items.length : 0,
);

// Bars share the column with a 1.5rem amount label on top
const barHeight = (value: number) => `calc((100% - 1.5rem) * ${max.value ? value / max.value : 0})`;

const compact = (minor: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    fromMinor(minor, props.currency),
  );

// Change vs the month before the tapped one
const change = computed(() => {
  const current = props.items[active.value];
  const previous = props.items[active.value - 1];
  if (!current || !previous?.total) return null;
  const rounded = Math.round(((current.total - previous.total) / previous.total) * 100);
  const good = rounded > 0 === props.upIsGood;
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded}% vs ${previous.label}`,
    icon: rounded > 0 ? "i-lucide-trending-up" : rounded < 0 ? "i-lucide-trending-down" : "i-lucide-equal",
    class: rounded === 0 ? "bg-elevated text-muted" : good ? "bg-success/15 text-success" : "bg-error/15 text-error",
  };
});

const fill = computed(() => ({
  background: `linear-gradient(180deg, var(--ui-${props.color}), color-mix(in oklab, var(--ui-${props.color}) 45%, transparent))`,
}));
const tint = computed(() => ({
  background: `color-mix(in oklab, var(--ui-${props.color}) 22%, transparent)`,
}));
</script>

<template>
  <div>
    <!-- Readout for the tapped month -->
    <p class="text-sm text-muted">{{ items[active]?.title }}</p>
    <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="font-display text-3xl font-bold tracking-tight text-highlighted tabular-nums">
        {{ formatAmount(items[active]?.total ?? 0, currency) }}
      </p>
      <span
        v-if="change"
        class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums"
        :class="change.class"
      >
        <UIcon :name="change.icon" class="size-3" />
        {{ change.label }}
      </span>
    </div>

    <div class="relative mt-6 h-52" role="group" :aria-label="label">
      <!-- Average line -->
      <div
        v-if="average && max"
        class="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/20"
        :style="{ bottom: barHeight(average) }"
      >
        <span class="absolute -top-2.5 right-0 rounded-md bg-elevated px-1.5 text-[10px] font-medium text-muted">
          avg
        </span>
      </div>

      <div class="grid h-full items-end gap-3" :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }">
        <button
          v-for="(item, i) in items"
          :key="item.key"
          type="button"
          :aria-label="`${item.title}: ${formatAmount(item.total, currency)}`"
          :aria-pressed="active === i"
          class="group flex h-full flex-col items-center justify-end outline-none"
          @click="selected = i"
        >
          <span
            class="mb-1.5 h-4 text-xs font-semibold tabular-nums transition-colors"
            :class="active === i ? 'text-highlighted' : 'text-muted'"
          >
            {{ item.total ? compact(item.total) : "" }}
          </span>
          <span
            class="block w-full min-h-1.5 rounded-t-xl rounded-b-sm transition-[height,box-shadow] duration-500 ease-out group-focus-visible:ring-2 group-focus-visible:ring-white/40 motion-reduce:transition-none"
            :class="active === i ? 'shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]' : ''"
            :style="[active === i ? fill : tint, { height: barHeight(item.total) }]"
          />
        </button>
      </div>
    </div>

    <!-- Month names on a baseline -->
    <div
      class="grid gap-3 border-t border-default pt-2 text-center text-xs"
      :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
    >
      <span
        v-for="(item, i) in items"
        :key="item.key"
        :class="active === i ? 'font-semibold text-highlighted' : 'text-muted'"
      >
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

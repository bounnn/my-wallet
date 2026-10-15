<script setup lang="ts">
// One savings goal on the plan page: saved of target, a progress bar with how far behind schedule it is,
// add money / take out, and a status strip (reached, behind, due date passed, on track)
const props = defineProps<{ goal: Goal; category?: Category; saved: number }>();
const emit = defineEmits<{ add: []; take: []; edit: []; delete: [] }>();

const name = computed(() => props.category?.name ?? "Goal");
const icon = computed(() => props.category?.icon ?? "i-lucide-piggy-bank");
const color = computed(() => props.category?.color ?? DEFAULT_CATEGORY_COLOR);
const progress = computed(() => goalProgress(props.goal, props.saved));

const menu = computed(() => [
  [
    { label: "Add money", icon: "i-lucide-plus", onSelect: () => emit("add") },
    { label: "Take out", icon: "i-lucide-minus", disabled: props.saved <= 0, onSelect: () => emit("take") },
    { label: "Edit", icon: "i-lucide-pencil", onSelect: () => emit("edit") },
  ],
  [{ label: "Delete", icon: "i-lucide-trash-2", color: "error" as const, onSelect: () => emit("delete") }],
]);

// Soft tinted strips, never a solid alarm fill; full class names so Tailwind can find them
const statusClass: Record<GoalStatus["tone"], string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/15 text-error",
  info: "bg-primary/20 text-navy-100",
};

// Add money button: a soft wash of the goal's color with a faint edge, so each card's action matches its goal
const addMoneyStyle = computed(() => ({
  background: `linear-gradient(180deg, ${colorMix(color.value, 28)}, ${colorMix(color.value, 16)})`,
  boxShadow: `inset 0 0 0 1px ${colorMix(color.value, 30)}`,
}));

// Bars in the goal's color (barTrackStyle / barFillStyle); the hatched stretch is how far behind schedule it is
const barBehindStyle = computed(() => ({
  left: `${progress.value.progress * 100}%`,
  width: `${progress.value.behind * 100}%`,
  background: `repeating-linear-gradient(-60deg, ${colorMix(color.value, 55)} 0 2px, transparent 2px 6px)`,
}));

const savedText = computed(() => formatAmount(props.saved, props.goal.currency));
</script>

<template>
  <div class="surface-card overflow-hidden rounded-2xl">
    <div class="p-4">
      <div class="flex items-start gap-3">
        <IconTile :icon="icon" :color="color" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-display font-bold tracking-tight text-highlighted">{{ name }}</p>
          <p class="text-sm text-muted tabular-nums">
            {{ goal.deadline ? `Due ${formatDate(goal.deadline)}` : "No due date" }}
          </p>
        </div>
        <UDropdownMenu :items="menu" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            :aria-label="`${name} options`"
            class="-mt-1 -mr-2"
          />
        </UDropdownMenu>
      </div>

      <!-- Wraps instead of cutting long amounts (e.g. LAK) short -->
      <div class="mt-4 flex flex-wrap items-baseline gap-x-2">
        <p class="font-display font-bold tracking-tight text-highlighted tabular-nums" :class="amountSizeClass(savedText)">
          {{ savedText }}
        </p>
        <p class="shrink-0 text-sm text-muted tabular-nums">of {{ formatAmount(goal.target, goal.currency) }}</p>
        <span class="ml-auto shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-muted">
          {{ goal.currency }}
        </span>
      </div>

      <!-- Progress bar with a knob at the saved amount -->
      <div
        class="relative mt-4 h-3 rounded-full"
        :style="barTrackStyle(color)"
        role="progressbar"
        :aria-valuenow="Math.floor(progress.progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${name} progress`"
      >
        <div class="absolute inset-y-0 rounded-r-full" :style="barBehindStyle" />
        <div
          class="bar-grow relative h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          :style="barFillStyle(color, progress.progress)"
        >
          <span
            v-if="progress.progress > 0 && progress.progress < 1"
            class="absolute top-1/2 right-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white shadow-md"
            :style="{ borderColor: colorVar(color) }"
          />
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between gap-3 text-sm">
        <p class="text-muted">
          Your progress
          <span class="font-medium text-toned tabular-nums">{{ Math.floor(progress.progress * 100) }}%</span>
        </p>
        <p v-if="progress.left" class="font-medium text-highlighted tabular-nums">
          {{ formatAmount(progress.left, goal.currency) }} left
        </p>
      </div>

      <!-- Add money tinted in the goal's color (the card's main action), take out as a quiet pill -->
      <div v-if="progress.left" class="mt-4 flex gap-2">
        <button
          type="button"
          class="flex h-12 flex-1 items-center justify-center rounded-full font-semibold text-highlighted transition-[transform,filter] hover:brightness-110 active:scale-[0.98] motion-reduce:active:scale-100"
          :style="addMoneyStyle"
          @click="emit('add')"
        >
          Add money
        </button>
        <button
          v-if="saved > 0"
          type="button"
          :aria-label="`Take money out of ${name}`"
          class="flex h-12 shrink-0 items-center justify-center rounded-full bg-elevated px-5 font-semibold text-toned transition-[transform,color] hover:text-highlighted active:scale-95 motion-reduce:active:scale-100"
          @click="emit('take')"
        >
          Take out
        </button>
      </div>
    </div>

    <p
      v-if="progress.status"
      class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
      :class="statusClass[progress.status.tone]"
    >
      <UIcon :name="progress.status.icon" class="size-4 shrink-0" />
      {{ progress.status.text }}
    </p>
  </div>
</template>

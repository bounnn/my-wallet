<script setup lang="ts">
// Picks the day months start on (1-28) as a grid of days; closes on pick. Home, report and plan count a month
// from it, e.g. from payday.
const open = defineModel<boolean>("open", { required: true });
const { startDay, setStartDay } = useMonthStart();

const days = Array.from({ length: 28 }, (_, i) => i + 1);

// An example with today's month, so the choice reads as dates, e.g. "25/10 – 24/11"
const example = computed(() => {
  const now = new Date();
  const { year, month } = monthOf(now, startDay.value);
  const { from, to } = monthRange(year, month, startDay.value);
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
  return `${formatDayMonth(from)} – ${formatDayMonth(last)}`;
});

function pick(day: number) {
  setStartDay(day);
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" title="First day of the month">
    <template #body>
      <p class="text-sm text-muted">
        Home, Report and Plan count each month from this day. Set it to your payday to follow your money from one
        salary to the next.
      </p>

      <div class="mt-4 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="First day of the month">
        <button
          v-for="day in days"
          :key="day"
          type="button"
          role="radio"
          :aria-checked="day === startDay"
          class="flex aspect-square items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-colors"
          :class="day === startDay ? 'btn-primary-gradient text-white' : 'bg-elevated text-toned active:bg-accented'"
          @click="pick(day)"
        >
          {{ day }}
        </button>
      </div>

      <p class="mt-4 text-center text-sm text-muted">
        This month runs <span class="font-medium text-toned tabular-nums">{{ example }}</span>
      </p>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date";

// Month switch in the header, styled like WalletPicker: ‹ and › step a month at a time, the month in the middle
// opens a month calendar in a modal (UCalendar type="month"). Future months are off. When months start on
// another day than the 1st (Settings), it shows the month's days instead, e.g. "25/10 – 24/11".
const month = defineModel<CalendarDate>({ required: true });

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
const fullFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const { startDay, currentMonth, rangeOf } = useMonthStart();
const thisMonth = currentMonth();
const open = ref(false);

const asDate = (d: CalendarDate) => new Date(d.year, d.month - 1, 1);
// First and last day of the picked month, e.g. "25/10 – 24/11"
const days = computed(() => {
  const { from, to } = rangeOf(month.value);
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
  return `${formatDayMonth(from)} – ${formatDayMonth(last)}`;
});
const label = computed(() => (startDay.value === 1 ? monthFormat.format(asDate(month.value)) : days.value));
const isThisMonth = computed(() => month.value.compare(thisMonth) === 0);
const isFutureMonth = (d: DateValue) => d.year * 12 + d.month > thisMonth.year * 12 + thisMonth.month;

function step(months: number) {
  const next = month.value.add({ months });
  if (!isFutureMonth(next)) month.value = next;
}

function onPick(picked: unknown) {
  const value = calendarPick(picked);
  if (!value) return;
  month.value = new CalendarDate(value.year, value.month, 1);
  open.value = false;
}

function goToThisMonth() {
  month.value = thisMonth;
  open.value = false;
}
</script>

<template>
  <div
    class="flex h-9 shrink-0 items-center rounded-xl bg-muted ring-1 ring-default ring-inset"
    role="group"
    aria-label="Month"
  >
    <button
      type="button"
      aria-label="Previous month"
      class="flex h-full w-9 items-center justify-center rounded-l-xl text-toned transition-colors active:bg-elevated"
      @click="step(-1)"
    >
      <UIcon name="i-lucide-chevron-left" class="size-4" />
    </button>
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-label="`${fullFormat.format(asDate(month))}, ${days}. Pick a month`"
      class="flex h-full min-w-22 items-center justify-center px-1 text-sm font-semibold whitespace-nowrap text-highlighted tabular-nums transition-colors active:bg-elevated"
      @click="open = true"
    >
      {{ label }}
    </button>
    <button
      type="button"
      aria-label="Next month"
      :disabled="isThisMonth"
      class="flex h-full w-9 items-center justify-center rounded-r-xl text-toned transition-colors active:bg-elevated disabled:text-dimmed/50"
      @click="step(1)"
    >
      <UIcon name="i-lucide-chevron-right" class="size-4" />
    </button>
  </div>

  <UModal v-model:open="open" title="Pick a month">
    <template #body>
      <UCalendar
        type="month"
        :model-value="month"
        :is-month-disabled="isFutureMonth"
        class="mx-auto"
        @update:model-value="onPick"
      />
      <p v-if="startDay !== 1" class="mt-3 text-center text-sm text-muted">
        Months start on day {{ startDay }}, so {{ fullFormat.format(asDate(month)) }} is
        <span class="font-medium text-toned tabular-nums">{{ days }}</span>
      </p>
      <UButton
        v-if="!isThisMonth"
        label="Back to this month"
        icon="i-lucide-calendar-check"
        color="neutral"
        variant="soft"
        size="xl"
        block
        class="mt-5 h-13 justify-center bg-elevated"
        @click="goToThisMonth"
      />
    </template>
  </UModal>
</template>

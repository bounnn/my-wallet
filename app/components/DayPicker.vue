<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, type DateValue } from "@internationalized/date";

// The add screen's date row: Today and Yesterday are one tap, any other past day is picked in a calendar modal.
// A row of a grouped card.
const day = defineModel<CalendarDate>({ required: true });

const now = new Date();
const today = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
const yesterday = today.subtract({ days: 1 });
const date = computed(() => day.value.toDate(getLocalTimeZone()));
const isToday = computed(() => day.value.compare(today) === 0);
const isYesterday = computed(() => day.value.compare(yesterday) === 0);
const isOtherDay = computed(() => !isToday.value && !isYesterday.value);
const isFutureDay = (d: DateValue) => d.compare(today) > 0;

const calendarOpen = ref(false);
function onPick(picked: unknown) {
  const value = calendarPick(picked);
  if (!value) return;
  day.value = new CalendarDate(value.year, value.month, value.day);
  calendarOpen.value = false;
}

const chip = (active: boolean) => (active ? "bg-primary/20 text-navy-100" : "bg-elevated text-muted hover:text-toned");
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2">
    <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-dimmed" />
    <div class="flex min-w-0 flex-1 gap-1.5" role="group" aria-label="Date">
      <button
        type="button"
        class="h-11 rounded-full px-3.5 text-sm font-medium transition-colors"
        :class="chip(isToday)"
        :aria-pressed="isToday"
        @click="day = today"
      >
        Today
      </button>
      <button
        type="button"
        class="h-11 rounded-full px-3.5 text-sm font-medium transition-colors"
        :class="chip(isYesterday)"
        :aria-pressed="isYesterday"
        @click="day = yesterday"
      >
        Yesterday
      </button>
      <button
        type="button"
        class="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3.5 text-sm font-medium transition-colors"
        :class="chip(isOtherDay)"
        :aria-label="isOtherDay ? `Date: ${dayLabel(date)}` : 'Pick another day'"
        @click="calendarOpen = true"
      >
        <span v-if="isOtherDay" class="truncate">{{ dayLabel(date) }}</span>
        <UIcon v-else name="i-lucide-ellipsis" class="size-4" />
      </button>
    </div>

    <UModal v-model:open="calendarOpen" title="Pick a date">
      <template #body>
        <UCalendar :model-value="day" :is-date-disabled="isFutureDay" class="mx-auto" @update:model-value="onPick" />
      </template>
    </UModal>
  </div>
</template>

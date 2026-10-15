<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date";

// Month pill + popover calendar (UCalendar type="month"); future months are disabled
const month = defineModel<CalendarDate>({ required: true });

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const now = new Date();
const thisMonth = new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1);
const open = ref(false);

const isFutureMonth = (d: DateValue) => d.year * 12 + d.month > thisMonth.year * 12 + thisMonth.month;

function onPick(value: DateValue | undefined) {
  if (!value) return;
  month.value = new CalendarDate(value.year, value.month, 1);
  open.value = false;
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
    <UButton
      :label="monthFormat.format(new Date(month.year, month.month - 1, 1))"
      icon="i-lucide-calendar"
      trailing-icon="i-lucide-chevron-down"
      color="neutral"
      variant="subtle"
      class="tabular-nums"
    />
    <template #content>
      <UCalendar
        type="month"
        :model-value="month"
        :is-month-disabled="isFutureMonth"
        class="p-2"
        @update:model-value="onPick"
      />
    </template>
  </UPopover>
</template>

import type { DateValue } from "@internationalized/date";

// The date a UCalendar picked. Its update event is typed for range and multiple modes too, which the
// single-date pickers here don't use, so anything else is undefined.
export function calendarPick(value: unknown) {
  return value && typeof value === "object" && "day" in value ? (value as DateValue) : undefined;
}

// Fixed DD/MM/YYYY, whatever the device locale, e.g. "14/10/2026"
export function formatDate(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// A month can start on another day than the 1st (e.g. payday, set in Settings; 1-28 so every month has it).
// It's named after the calendar month it starts in: starting on the 25th, "October" runs 25/10 to 24/11.
// `month` is 1-12; the range is [from, to).
export function monthRange(year: number, month: number, startDay: number) {
  return { from: new Date(year, month - 1, startDay), to: new Date(year, month, startDay) };
}

// The month (year, 1-12) a date falls in
export function monthOf(date: Date, startDay: number) {
  const start = date.getDate() >= startDay ? date : new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { year: start.getFullYear(), month: start.getMonth() + 1 };
}

// Month as "YYYY-MM", e.g. "2026-10" (budgets are stored per month); sorts in date order
export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Midnight on the Monday of the date's week (weeks run Monday → Sunday)
export function startOfWeek(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
}

// Short DD/MM, e.g. "14/10"
export function formatDayMonth(date: Date) {
  return formatDate(date).slice(0, 5);
}

// Day name inside a week: "Today", "Yesterday", or "Wed 14/10"
export function weekdayLabel(date: Date) {
  const label = dayLabel(date);
  if (label !== formatDate(date)) return label;
  return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${formatDayMonth(date)}`;
}

// Relative day name: "Today", "Yesterday", or DD/MM/YYYY
export function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(date);
}

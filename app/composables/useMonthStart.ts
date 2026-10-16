import { CalendarDate } from "@internationalized/date";

const STORAGE_KEY = "my-wallet-month-start";

/**
 * The day months start on (1-28, set in Settings; 1 by default). Home, report and plan count a month from it,
 * e.g. from payday to the day before the next one (monthRange in utils/date.ts). Remembered on this device.
 */
export function useMonthStart() {
  const startDay = useState<number>("month-start", () => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isInteger(saved) && saved >= 1 && saved <= 28 ? saved : 1;
    } catch {
      return 1;
    }
  });

  function setStartDay(day: number) {
    startDay.value = day;
    try {
      localStorage.setItem(STORAGE_KEY, String(day));
    } catch {}
  }

  // The month today is in, as the month pickers hold it (the 1st of the month it's named after)
  function currentMonth() {
    const { year, month } = monthOf(new Date(), startDay.value);
    return new CalendarDate(year, month, 1);
  }

  // A picked month's [from, to); `offset` moves it by whole months (-1 = the month before)
  function rangeOf(month: CalendarDate, offset = 0) {
    const m = month.add({ months: offset });
    return monthRange(m.year, m.month, startDay.value);
  }

  return { startDay, setStartDay, currentMonth, rangeOf };
}

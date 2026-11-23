import { addDays, parseDayKey } from '@/data/day';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The Monday of the week containing `day` (YYYY-MM-DD). Returns `day` unchanged if it is not a valid key. */
export function weekStart(day: string): string {
  const d = parseDayKey(day);
  if (!d) return day;
  const sinceMonday = (d.getDay() + 6) % 7;
  return addDays(day, -sinceMonday);
}

/** The seven day keys, Monday to Sunday, of the week containing `day`. */
export function weekDays(day: string): string[] {
  const start = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

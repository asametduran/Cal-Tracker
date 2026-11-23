import type { Macros, Totals } from './types';

/** Local-time calendar day as `YYYY-MM-DD` (never UTC, so late-night meals stay on their day). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight for a `YYYY-MM-DD` key, or null when it is not a real calendar day. */
export function parseDayKey(key: string | undefined): Date | null {
  const match = key ? DAY_KEY.exec(key) : null;
  if (!key || !match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === key ? date : null;
}

export function addDays(key: string, delta: number): string {
  const base = parseDayKey(key);
  if (!base) return key;
  return dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta));
}

/** Epoch ms on day `key` at the same local time-of-day as `now`. */
export function loggedAtForDay(key: string, now: Date = new Date()): number {
  const base = parseDayKey(key);
  if (!base) return now.getTime();
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).getTime();
}

/** Turns an untrusted day key (e.g. a URL param) into a valid day no later than today. */
export function resolveDay(key: string | undefined, today: Date = new Date()): string {
  const todayKey = dayKey(today);
  if (!key || !parseDayKey(key)) return todayKey;
  return key > todayKey ? todayKey : key;
}

export function formatDayLabel(key: string, today: Date = new Date()): string {
  const todayKey = dayKey(today);
  if (key === todayKey) return 'Today';
  if (key === addDays(todayKey, -1)) return 'Yesterday';
  const date = parseDayKey(key);
  if (!date) return key;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function sumMeals(meals: readonly Macros[]): Totals {
  return meals.reduce<Totals>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

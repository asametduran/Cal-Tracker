import { dayKey } from '@/data/day';
import type { Meal, Totals } from '@/data/types';

export type MonthRef = { year: number; month0: number };

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

/** Day keys for a month laid out Sunday-first in whole weeks; null pads the edges. */
export function monthCells(ref: MonthRef): (string | null)[] {
  const lead = new Date(ref.year, ref.month0, 1).getDay();
  const days = new Date(ref.year, ref.month0 + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(ref.year, ref.month0, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthBounds(ref: MonthRef): { from: string; to: string } {
  return {
    from: dayKey(new Date(ref.year, ref.month0, 1)),
    to: dayKey(new Date(ref.year, ref.month0 + 1, 0)),
  };
}

export function totalsByDay(meals: readonly Meal[]): Record<string, Totals> {
  const out: Record<string, Totals> = {};
  for (const meal of meals) {
    const t = (out[meal.day] ??= { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    t.calories += meal.calories;
    t.proteinG += meal.proteinG;
    t.carbsG += meal.carbsG;
    t.fatG += meal.fatG;
  }
  return out;
}

/** Whole-number percent of the calorie goal, or null when there is no usable goal. */
export function percentOfGoal(calories: number, goal: number): number | null {
  if (!(goal > 0)) return null;
  return Math.round((calories / goal) * 100);
}

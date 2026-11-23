import type { Meal, WeightEntry } from '@/data/types';

export type LogItem =
  | { kind: 'meal'; at: number; meal: Meal }
  | { kind: 'weight'; at: number; entry: WeightEntry };

/** Meals and weigh-ins in one list, newest first. */
export function mergeLog(meals: readonly Meal[], weights: readonly WeightEntry[]): LogItem[] {
  const items: LogItem[] = [
    ...meals.map((meal) => ({ kind: 'meal' as const, at: meal.loggedAt, meal })),
    ...weights.map((entry) => ({ kind: 'weight' as const, at: entry.loggedAt, entry })),
  ];
  return items.sort((a, b) => b.at - a.at);
}

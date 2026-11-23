import type { Meal, WeightEntry } from '@/data/types';

import { mergeLog } from './log';

const meal = (id: string, loggedAt: number): Meal => ({
  id,
  title: id,
  day: '2026-11-23',
  loggedAt,
  calories: 100,
  proteinG: 1,
  carbsG: 1,
  fatG: 1,
});
const weight = (id: string, loggedAt: number): WeightEntry => ({ id, day: '2026-11-23', loggedAt, kg: 80 });

describe('mergeLog', () => {
  it('interleaves meals and weigh-ins, newest first', () => {
    const items = mergeLog([meal('breakfast', 100), meal('dinner', 300)], [weight('morning', 50), weight('noon', 200)]);
    expect(items.map((i) => (i.kind === 'meal' ? i.meal.id : i.entry.id))).toEqual([
      'dinner',
      'noon',
      'breakfast',
      'morning',
    ]);
    expect(items.map((i) => i.kind)).toEqual(['meal', 'weight', 'meal', 'weight']);
  });

  it('handles empty inputs and does not mutate them', () => {
    expect(mergeLog([], [])).toEqual([]);
    const meals = [meal('a', 1), meal('b', 2)];
    mergeLog(meals, []);
    expect(meals.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

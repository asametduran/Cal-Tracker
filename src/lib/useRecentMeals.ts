import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { addDays, dayKey, repositories, useDataVersion, type Meal } from '@/data';

import { currentStreak } from './streak';

const WINDOW_DAYS = 200;

/**
 * The last ~200 days of meals, reloaded on focus and whenever data changes (sync, saves). Drives the streak,
 * the week strip's logged markers and the daily average, so the screens do not each fetch their own copy.
 */
export function useRecentMeals(today: string = dayKey(new Date())) {
  const dataVersion = useDataVersion();
  const [meals, setMeals] = useState<Meal[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    repositories.meals.listMealsForRange(addDays(today, -WINDOW_DAYS), today).then(
      (list) => {
        if (!cancelled) setMeals(list);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion only triggers a reload
  }, [today, dataVersion]);

  useFocusEffect(load);

  const loggedDays = useMemo(() => new Set(meals.map((m) => m.day)), [meals]);
  const streak = useMemo(() => currentStreak(loggedDays, today), [loggedDays, today]);

  return { meals, loggedDays, streak };
}

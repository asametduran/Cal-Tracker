import { addDays } from '@/data/day';

import { weekDays } from './week';

/**
 * Consecutive days with something logged, ending today. Today not being logged yet does not break the
 * streak (there is still time), so counting then starts from yesterday.
 */
export function currentStreak(logged: ReadonlySet<string>, today: string): number {
  let cursor = logged.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (logged.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Monday..Sunday flags for the week containing `today`: was something logged that day? */
export function weekFlags(logged: ReadonlySet<string>, today: string): boolean[] {
  return weekDays(today).map((d) => logged.has(d));
}

import type { Meal } from '@/data/types';

import { monthBounds, monthCells, percentOfGoal, shiftMonth, totalsByDay } from './calendar';

const meal = (day: string, calories: number, proteinG = 0): Meal => ({
  id: `${day}-${calories}`,
  title: 'x',
  day,
  loggedAt: 0,
  calories,
  proteinG,
  carbsG: 0,
  fatG: 0,
});

describe('monthCells', () => {
  it('pads to whole weeks with the first day on the right weekday', () => {
    // November 2026 starts on a Sunday and has 30 days -> 5 weeks.
    const cells = monthCells({ year: 2026, month0: 10 });
    expect(cells).toHaveLength(35);
    expect(cells[0]).toBe('2026-11-01');
    expect(cells[29]).toBe('2026-11-30');
    expect(cells.slice(30).every((c) => c === null)).toBe(true);
  });

  it('adds leading blanks when the month does not start on Sunday', () => {
    // December 2026 starts on a Tuesday.
    const cells = monthCells({ year: 2026, month0: 11 });
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells[2]).toBe('2026-12-01');
    expect(cells.length % 7).toBe(0);
  });

  it('handles a leap-year February', () => {
    const cells = monthCells({ year: 2028, month0: 1 }).filter(Boolean);
    expect(cells).toHaveLength(29);
  });
});

describe('monthBounds and shiftMonth', () => {
  it('returns first and last day', () => {
    expect(monthBounds({ year: 2026, month0: 1 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('rolls over year boundaries in both directions', () => {
    expect(shiftMonth({ year: 2026, month0: 11 }, 1)).toEqual({ year: 2027, month0: 0 });
    expect(shiftMonth({ year: 2026, month0: 0 }, -1)).toEqual({ year: 2025, month0: 11 });
  });
});

describe('totalsByDay', () => {
  it('sums per day and leaves empty days out', () => {
    const totals = totalsByDay([meal('2026-11-02', 300, 20), meal('2026-11-02', 150, 5), meal('2026-11-03', 500)]);
    expect(Object.keys(totals).sort()).toEqual(['2026-11-02', '2026-11-03']);
    expect(totals['2026-11-02']).toEqual({ calories: 450, proteinG: 25, carbsG: 0, fatG: 0 });
  });
});

describe('percentOfGoal', () => {
  it('rounds and allows going over 100', () => {
    expect(percentOfGoal(1000, 2000)).toBe(50);
    expect(percentOfGoal(2500, 2000)).toBe(125);
    expect(percentOfGoal(1, 3)).toBe(33);
  });

  it('is null without a usable goal', () => {
    expect(percentOfGoal(100, 0)).toBeNull();
    expect(percentOfGoal(100, -5)).toBeNull();
  });
});

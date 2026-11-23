import { addDays, dayKey, formatDayLabel, loggedAtForDay, parseDayKey, resolveDay, sumMeals } from './day';

describe('parseDayKey', () => {
  it('parses real days to local midnight', () => {
    expect(parseDayKey('2026-11-23')).toEqual(new Date(2026, 10, 23));
  });

  it('rejects impossible or malformed days', () => {
    for (const bad of ['2026-02-30', '2026-13-01', 'abc', '2026-1-1', '', undefined]) {
      expect(parseDayKey(bad)).toBeNull();
    }
  });
});

describe('addDays', () => {
  it('crosses month, year and DST boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('loggedAtForDay', () => {
  it('keeps the current time of day on the chosen date', () => {
    const now = new Date(2026, 10, 23, 14, 5, 9);
    expect(loggedAtForDay('2026-11-20', now)).toBe(new Date(2026, 10, 20, 14, 5, 9).getTime());
    expect(dayKey(new Date(loggedAtForDay('2026-11-20', now)))).toBe('2026-11-20');
  });
});

describe('resolveDay', () => {
  const today = new Date(2026, 10, 23, 12);

  it('falls back to today for missing or garbage input', () => {
    expect(resolveDay(undefined, today)).toBe('2026-11-23');
    expect(resolveDay('nonsense', today)).toBe('2026-11-23');
  });

  it('clamps future days to today and keeps past days', () => {
    expect(resolveDay('2026-12-25', today)).toBe('2026-11-23');
    expect(resolveDay('2026-11-01', today)).toBe('2026-11-01');
  });
});

describe('formatDayLabel', () => {
  const today = new Date(2026, 10, 23, 12);

  it('names today and yesterday', () => {
    expect(formatDayLabel('2026-11-23', today)).toBe('Today');
    expect(formatDayLabel('2026-11-22', today)).toBe('Yesterday');
  });

  it('formats older days with their date', () => {
    expect(formatDayLabel('2026-11-17', today)).toContain('17');
  });
});

describe('dayKey', () => {
  it('formats the local date with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
  });

  it('keeps a 23:59 local meal on its own day and 00:01 on the next', () => {
    expect(dayKey(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(dayKey(new Date(2026, 10, 24, 0, 1))).toBe('2026-11-24');
  });
});

describe('sumMeals', () => {
  it('returns zeros for no meals', () => {
    expect(sumMeals([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('adds every macro', () => {
    const total = sumMeals([
      { calories: 300, proteinG: 20, carbsG: 30, fatG: 10 },
      { calories: 150, proteinG: 5, carbsG: 25, fatG: 2 },
    ]);
    expect(total).toEqual({ calories: 450, proteinG: 25, carbsG: 55, fatG: 12 });
  });
});

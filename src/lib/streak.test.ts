import { currentStreak, weekFlags } from './streak';
import { weekDays, weekStart } from './week';

// 2026-11-23 is a Monday.
const MON = '2026-11-23';

describe('currentStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(currentStreak(new Set(), MON)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(new Set(['2026-11-21', '2026-11-22', MON]), MON)).toBe(3);
  });

  it('keeps yesterday’s streak alive while today is still empty', () => {
    expect(currentStreak(new Set(['2026-11-21', '2026-11-22']), MON)).toBe(2);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(new Set(['2026-11-19', '2026-11-22', MON]), MON)).toBe(2);
  });

  it('is 0 when the last log was two or more days ago', () => {
    expect(currentStreak(new Set(['2026-11-20']), MON)).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(currentStreak(new Set(['2026-12-30', '2026-12-31', '2027-01-01']), '2027-01-01')).toBe(3);
  });
});

describe('weekStart / weekDays', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(weekStart('2026-11-25')).toBe('2026-11-23');
  });

  it('lists Monday to Sunday', () => {
    expect(weekDays('2026-11-26')).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('returns invalid input unchanged', () => {
    expect(weekStart('nope')).toBe('nope');
  });
});

describe('weekFlags', () => {
  it('flags the logged days of the current week', () => {
    expect(weekFlags(new Set(['2026-11-23', '2026-11-25', '2026-11-30']), '2026-11-25')).toEqual([true, false, true, false, false, false, false]);
  });
});

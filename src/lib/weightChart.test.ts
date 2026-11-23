import type { WeightEntry } from '@/data/types';

import { filterRange, latestPerDay, scalePoints, weightChange } from './weightChart';

const w = (day: string, kg: number, hour = 8): WeightEntry => {
  const [y, m, d] = day.split('-').map(Number);
  return { id: `${day}-${hour}`, day, kg, loggedAt: new Date(y, m - 1, d, hour).getTime() };
};

describe('latestPerDay', () => {
  it('keeps the last entry of each day, oldest first', () => {
    const result = latestPerDay([w('2026-11-02', 80.4, 20), w('2026-11-01', 81), w('2026-11-02', 80.9, 7)]);
    expect(result.map((e) => [e.day, e.kg])).toEqual([
      ['2026-11-01', 81],
      ['2026-11-02', 80.4],
    ]);
  });
});

describe('filterRange', () => {
  const today = new Date(2026, 10, 23, 12);
  const entries = [w('2026-05-20', 85), w('2026-09-01', 83), w('2026-10-25', 82), w('2026-11-20', 81)];

  it('keeps everything for ALL', () => {
    expect(filterRange(entries, 'ALL', today)).toHaveLength(4);
  });

  it('keeps roughly the last 1, 3 and 6 months', () => {
    expect(filterRange(entries, '1M', today).map((e) => e.day)).toEqual(['2026-10-25', '2026-11-20']);
    expect(filterRange(entries, '3M', today).map((e) => e.day)).toEqual(['2026-09-01', '2026-10-25', '2026-11-20']);
    expect(filterRange(entries, '6M', today).map((e) => e.day)).toEqual(['2026-09-01', '2026-10-25', '2026-11-20']);
  });

  it('returns an empty list when nothing falls in range', () => {
    expect(filterRange([w('2025-01-01', 90)], '1M', today)).toEqual([]);
  });
});

describe('weightChange', () => {
  it('is last minus first, one decimal, null under two days', () => {
    expect(weightChange([w('2026-11-01', 82.5), w('2026-11-10', 81.1)])).toBe(-1.4);
    expect(weightChange([w('2026-11-01', 82.5)])).toBeNull();
    expect(weightChange([])).toBeNull();
    expect(weightChange([w('2026-11-01', 82.5, 7), w('2026-11-01', 82.1, 9)])).toBeNull();
  });
});

describe('scalePoints', () => {
  it('puts later days further right and heavier weights higher up', () => {
    const { points } = scalePoints([w('2026-11-01', 80), w('2026-11-11', 78), w('2026-11-21', 79)], 300, 100);
    expect(points[0].x).toBeLessThan(points[1].x);
    expect(points[1].x).toBeLessThan(points[2].x);
    expect(points[0].y).toBeLessThan(points[2].y);
    expect(points[2].y).toBeLessThan(points[1].y);
  });

  it('spaces points by calendar days, not by index', () => {
    const { points } = scalePoints([w('2026-11-01', 80), w('2026-11-02', 80.5), w('2026-11-21', 79)], 300, 100);
    expect(points[1].x - points[0].x).toBeLessThan(points[2].x - points[1].x);
  });

  it('keeps every point inside the padded box', () => {
    const pad = { left: 10, right: 10, top: 10, bottom: 10 };
    const { points } = scalePoints([w('2026-11-01', 90), w('2026-11-05', 60), w('2026-11-09', 75)], 200, 120, pad);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(190);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(110);
    }
  });

  it('centres a single point and handles a flat series without NaN', () => {
    const single = scalePoints([w('2026-11-01', 80)], 200, 100).points[0];
    expect(single.x).toBe(100);
    expect(Number.isFinite(single.y)).toBe(true);
    const flat = scalePoints([w('2026-11-01', 80), w('2026-11-08', 80)], 200, 100).points;
    expect(flat.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('returns nothing for no entries', () => {
    expect(scalePoints([], 200, 100)).toEqual({ points: [], minKg: 0, maxKg: 0 });
  });
});

import { addDays, dayKey, parseDayKey } from '@/data/day';
import type { WeightEntry } from '@/data/types';

export type WeightRange = '1M' | '3M' | '6M' | 'ALL';

const RANGE_DAYS = { '1M': 30, '3M': 91, '6M': 182 } as const;

/** The last entry of each day, oldest first. */
export function latestPerDay(entries: readonly WeightEntry[]): WeightEntry[] {
  const sorted = [...entries].sort((a, b) => a.loggedAt - b.loggedAt);
  const byDay = new Map<string, WeightEntry>();
  for (const entry of sorted) byDay.set(entry.day, entry);
  return [...byDay.values()];
}

/** Entries within the range ending today. `ALL` keeps everything. */
export function filterRange(
  entries: readonly WeightEntry[],
  range: WeightRange,
  today: Date = new Date(),
): WeightEntry[] {
  if (range === 'ALL') return [...entries];
  const from = addDays(dayKey(today), -RANGE_DAYS[range]);
  return entries.filter((entry) => entry.day >= from);
}

/** Last minus first kilograms (one decimal), or null with fewer than two points. */
export function weightChange(entries: readonly WeightEntry[]): number | null {
  const days = latestPerDay(entries);
  if (days.length < 2) return null;
  return Math.round((days[days.length - 1].kg - days[0].kg) * 10) / 10;
}

export type ChartPoint = { x: number; y: number; entry: WeightEntry };
export type ChartScale = { points: ChartPoint[]; minKg: number; maxKg: number };
export type ChartPadding = { left: number; right: number; top: number; bottom: number };

const DEFAULT_PADDING: ChartPadding = { left: 8, right: 8, top: 12, bottom: 12 };

function dayNumber(key: string): number {
  const d = parseDayKey(key);
  return d ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000 : 0;
}

/**
 * Maps entries (one per day, oldest first) to pixel positions: x by calendar day,
 * y by kilograms with a little headroom. A single point is centred; a flat series
 * gets a 1 kg band so nothing divides by zero.
 */
export function scalePoints(
  entries: readonly WeightEntry[],
  width: number,
  height: number,
  pad: ChartPadding = DEFAULT_PADDING,
): ChartScale {
  if (entries.length === 0) return { points: [], minKg: 0, maxKg: 0 };

  const kgs = entries.map((e) => e.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const span = Math.max(hi - lo, 1);
  const minKg = lo - span * 0.1 - (hi - lo < 1 ? (1 - (hi - lo)) / 2 : 0);
  const maxKg = hi + span * 0.1 + (hi - lo < 1 ? (1 - (hi - lo)) / 2 : 0);

  const first = dayNumber(entries[0].day);
  const last = dayNumber(entries[entries.length - 1].day);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = entries.map((entry) => {
    const x = last === first ? pad.left + innerW / 2 : pad.left + ((dayNumber(entry.day) - first) / (last - first)) * innerW;
    const y = pad.top + (1 - (entry.kg - minKg) / (maxKg - minKg)) * innerH;
    return { x, y, entry };
  });
  return { points, minKg, maxKg };
}

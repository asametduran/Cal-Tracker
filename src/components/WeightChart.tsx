import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { addDays, parseDayKey } from '@/data/day';
import type { WeightEntry } from '@/data/types';
import { filterRange, latestPerDay, scalePoints, weightChange, type WeightRange } from '@/lib/weightChart';
import { colors, spacing } from '@/theme';

import { Chip } from './ui';

const RANGES: { value: WeightRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'ALL', label: 'All' },
];

const HEIGHT = 170;
const PADDING = { left: 40, right: 10, top: 16, bottom: 16 };

function dayDiff(a: string, b: string): number {
  const da = parseDayKey(a);
  const db = parseDayKey(b);
  if (!da || !db) return 0;
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86_400_000);
}

function formatDate(key: string, withYear: boolean): string {
  const d = parseDayKey(key);
  if (!d) return key;
  return d.toLocaleDateString(undefined, withYear ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' });
}

/** Weight line chart with date labels and 1M / 3M / 6M / All filters. */
export function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const [range, setRange] = useState<WeightRange>('3M');
  const [width, setWidth] = useState(0);

  const visible = useMemo(() => latestPerDay(filterRange(entries, range)), [entries, range]);
  const all = useMemo(() => latestPerDay(entries), [entries]);
  const current = all.length > 0 ? all[all.length - 1] : null;
  const change = weightChange(visible);

  const scale = useMemo(() => scalePoints(visible, width, HEIGHT, PADDING), [visible, width]);
  const { points } = scale;

  const first = visible[0];
  const last = visible[visible.length - 1];
  const span = first && last ? dayDiff(first.day, last.day) : 0;
  const withYear = span > 300;
  const innerW = width - PADDING.left - PADDING.right;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const hi = points.length ? points.reduce((a, b) => (b.entry.kg > a.entry.kg ? b : a)) : null;
  const lo = points.length ? points.reduce((a, b) => (b.entry.kg < a.entry.kg ? b : a)) : null;
  const showDots = points.length <= 40;

  return (
    <View>
      <View style={styles.summary}>
        <View>
          <Text style={styles.title}>Weight Progress</Text>
          <Text style={styles.sub}>{current ? `Now ${current.kg} kg` : 'No weight logged yet'}</Text>
        </View>
        {change !== null ? (
          <Text style={styles.change}>
            {change > 0 ? '+' : change < 0 ? '−' : ''}
            {Math.abs(change)} kg
          </Text>
        ) : null}
      </View>

      <View style={styles.chips}>
        {RANGES.map((r) => (
          <Chip key={r.value} compact label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />
        ))}
      </View>

      <View style={styles.chart} onLayout={(e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {points.length === 0 ? (
          <Text style={styles.empty}>
            {entries.length === 0 ? 'Tap + on Today and choose Log weight to start your chart.' : 'No weigh-ins in this range.'}
          </Text>
        ) : width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {hi ? <Line x1={PADDING.left} x2={width - PADDING.right} y1={hi.y} y2={hi.y} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" /> : null}
              {lo && lo !== hi ? (
                <Line x1={PADDING.left} x2={width - PADDING.right} y1={lo.y} y2={lo.y} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
              ) : null}
              {points.length > 1 ? <Path d={path} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
              {showDots
                ? points.slice(0, -1).map((p) => <Circle key={p.entry.id} cx={p.x} cy={p.y} r={3} fill={colors.accent} />)
                : null}
              <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={5} fill={colors.card} stroke={colors.accent} strokeWidth={2.5} />
            </Svg>
            {hi ? <Text style={[styles.axis, { top: hi.y - 7 }]}>{hi.entry.kg}</Text> : null}
            {lo && lo !== hi ? <Text style={[styles.axis, { top: lo.y - 7 }]}>{lo.entry.kg}</Text> : null}
          </>
        ) : null}
      </View>

      {first && last && width > 0 ? (
        <View style={styles.dates}>
          <Text style={[styles.date, { left: PADDING.left }]}>{formatDate(first.day, withYear)}</Text>
          {span >= 14 ? (
            <Text style={[styles.date, styles.dateMid, { left: PADDING.left + innerW / 2 - 40 }]}>
              {formatDate(addDays(first.day, Math.round(span / 2)), withYear)}
            </Text>
          ) : null}
          {span > 0 ? <Text style={[styles.date, { right: PADDING.right }]}>{formatDate(last.day, withYear)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  change: { color: colors.weight, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chart: { height: HEIGHT, justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.md },
  axis: { position: 'absolute', left: 0, width: PADDING.left - 8, textAlign: 'right', color: colors.muted, fontSize: 11 },
  dates: { height: 20, marginTop: spacing.xs },
  date: { position: 'absolute', top: 0, color: colors.muted, fontSize: 11 },
  dateMid: { width: 80, textAlign: 'center' },
});

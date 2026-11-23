import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays } from '@/data/day';
import { WEEKDAY_SHORT, weekDays } from '@/lib/week';
import { colors, spacing } from '@/theme';

import { Icon } from './Icon';

type Props = {
  /** The viewed day (YYYY-MM-DD); its Monday-to-Sunday week is shown. */
  day: string;
  today: string;
  /** Days with something logged get a solid ring. */
  loggedDays: ReadonlySet<string>;
  onSelect: (day: string) => void;
};

/** Seven-day strip (Mon to Sun) under the header. Chevrons step a week back or forward. */
export function WeekStrip({ day, today, loggedDays, onSelect }: Props) {
  const days = weekDays(day);
  const nextWeekDisabled = days[6] >= today;
  const shiftWeek = (weeks: number) => {
    const target = addDays(day, weeks * 7);
    onSelect(target > today ? today : target);
  };

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={8} onPress={() => shiftWeek(-1)} style={styles.chevron}>
        <Icon name="back" size={16} color={colors.muted} />
      </Pressable>
      {days.map((d, i) => {
        const future = d > today;
        const selected = d === day;
        const logged = loggedDays.has(d);
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAY_SHORT[i]} ${Number(d.slice(8))}${logged ? ', logged' : ''}`}
            accessibilityState={{ selected, disabled: future }}
            disabled={future}
            onPress={() => onSelect(d)}
            style={styles.cell}
          >
            <Text style={[styles.weekday, d === today && styles.weekdayToday]}>{WEEKDAY_SHORT[i]}</Text>
            <View style={[styles.circle, logged ? styles.circleLogged : styles.circleEmpty, selected && styles.circleSelected, future && styles.circleFuture]}>
              <Text style={[styles.number, selected && styles.numberSelected]}>{Number(d.slice(8))}</Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next week"
        disabled={nextWeekDisabled}
        hitSlop={8}
        onPress={() => shiftWeek(1)}
        style={[styles.chevron, nextWeekDisabled && styles.chevronDisabled]}
      >
        <View style={styles.flip}>
          <Icon name="back" size={16} color={colors.muted} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.md },
  chevron: { width: 20, alignItems: 'center', justifyContent: 'center', height: 56 },
  chevronDisabled: { opacity: 0.25 },
  flip: { transform: [{ scaleX: -1 }] },
  cell: { flex: 1, alignItems: 'center', gap: 6 },
  weekday: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  weekdayToday: { color: colors.text },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  circleEmpty: { borderColor: colors.muted, borderStyle: 'dashed', opacity: 0.6 },
  circleLogged: { borderColor: colors.accent, backgroundColor: colors.card },
  circleSelected: { backgroundColor: colors.accent, borderColor: colors.accent, opacity: 1, borderStyle: 'solid' },
  circleFuture: { opacity: 0.3 },
  number: { color: colors.text, fontSize: 14, fontWeight: '600' },
  numberSelected: { color: colors.onAccent },
});

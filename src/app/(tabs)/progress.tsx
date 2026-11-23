import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddMenu, type AddChoice } from '@/components/AddMenu';
import { Icon } from '@/components/Icon';
import { MealRow } from '@/components/MealRow';
import { Button } from '@/components/ui';
import { WeightChart } from '@/components/WeightChart';
import { WeightRow } from '@/components/WeightRow';
import {
  DEFAULT_GOALS,
  addDays,
  dayKey,
  formatDayLabel,
  repositories,
  sumMeals,
  type Goals,
  type Meal,
  type WeightEntry,
  useDataVersion,
} from '@/data';
import { monthBounds, monthCells, percentOfGoal, shiftMonth, totalsByDay, type MonthRef } from '@/lib/calendar';
import { mergeLog } from '@/lib/log';
import { weekFlags } from '@/lib/streak';
import { useRecentMeals } from '@/lib/useRecentMeals';
import { latestPerDay } from '@/lib/weightChart';
import { colors, radius, shadow, spacing } from '@/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const STREAK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const AVERAGE_WINDOW_DAYS = 30;

/** Green near the goal, red well over it, grey while still under. */
function progressColor(percent: number): string {
  if (percent > 110) return colors.danger;
  if (percent >= 90) return colors.success;
  return colors.muted;
}

export default function ProgressScreen() {
  const [todayKey] = useState(() => dayKey(new Date()));
  const [month, setMonth] = useState<MonthRef>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month0: now.getMonth() };
  });
  const [selected, setSelected] = useState(todayKey);
  const dataVersion = useDataVersion();
  const { meals: recentMeals, loggedDays, streak } = useRecentMeals(todayKey);
  const [monthMeals, setMonthMeals] = useState<Meal[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { from, to } = monthBounds(month);
      const [g, m, w] = await Promise.all([
        repositories.goals.getGoals(),
        repositories.meals.listMealsForRange(from, to),
        repositories.weights.listWeights(),
      ]);
      setGoals(g);
      setMonthMeals(m);
      setWeights(w);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion only triggers a reload
  }, [month, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dayTotals = useMemo(() => totalsByDay(monthMeals), [monthMeals]);
  const cells = monthCells(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const selectedMeals = monthMeals.filter((m) => m.day === selected);
  const selectedLog = useMemo(
    () =>
      mergeLog(
        selectedMeals,
        weights.filter((w) => w.day === selected),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedMeals is derived from monthMeals + selected
    [monthMeals, weights, selected],
  );
  const selectedTotals = sumMeals(selectedMeals);
  const selectedPercent = percentOfGoal(selectedTotals.calories, goals.calories);

  const latestWeight = useMemo(() => {
    const days = latestPerDay(weights);
    return days.length > 0 ? days[days.length - 1] : null;
  }, [weights]);
  const flags = weekFlags(loggedDays, todayKey);

  // Average over the days in the last 30 that have something logged (empty days would only drag it down).
  const average = useMemo(() => {
    const since = addDays(todayKey, -(AVERAGE_WINDOW_DAYS - 1));
    const totals = totalsByDay(recentMeals.filter((m) => m.day >= since));
    const days = Object.values(totals);
    if (days.length === 0) return null;
    const kcal = Math.round(days.reduce((sum, t) => sum + t.calories, 0) / days.length);
    return { kcal, days: days.length, percent: percentOfGoal(kcal, goals.calories) };
  }, [recentMeals, todayKey, goals.calories]);

  const currentMonth = { year: Number(todayKey.slice(0, 4)), month0: Number(todayKey.slice(5, 7)) - 1 };
  const atCurrentMonth = month.year === currentMonth.year && month.month0 === currentMonth.month0;
  const monthTitle = new Date(month.year, month.month0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    const isCurrent = next.year === currentMonth.year && next.month0 === currentMonth.month0;
    setSelected(isCurrent ? todayKey : dayKey(new Date(next.year, next.month0, 1)));
  }

  function handleAdd(choice: AddChoice) {
    setMenuOpen(false);
    const target = choice === 'photo' ? '/capture' : choice === 'manual' ? '/meal' : '/weight';
    router.push({ pathname: target, params: { day: selected } });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Progress</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.card, styles.summaryCard]}>
            <Text style={styles.cardLabel}>Your Weight</Text>
            <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
              {latestWeight ? `${latestWeight.kg} kg` : '—'}
            </Text>
            <Text style={styles.cardHint}>{latestWeight ? 'Latest weigh-in' : 'Nothing logged yet'}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/weight', params: { day: todayKey } })}
              style={({ pressed }) => [styles.logWeight, pressed && styles.pressed]}
            >
              <Text style={styles.logWeightText}>Log Weight</Text>
            </Pressable>
          </View>

          <View style={[styles.card, styles.summaryCard, styles.streakCard]}>
            <View style={styles.flameWrap} accessibilityLabel={`${streak} day streak`}>
              <Icon name="flame" size={64} color={colors.streak} filled strokeWidth={1.5} />
              <Text style={styles.flameCount}>{streak}</Text>
            </View>
            <Text style={styles.streakLabel}>Day Streak</Text>
            <View style={styles.streakDays}>
              {STREAK_LETTERS.map((letter, i) => (
                <View key={i} style={styles.streakDay}>
                  <Text style={styles.streakLetter}>{letter}</Text>
                  <View style={[styles.streakDot, flags[i] && styles.streakDotOn]}>
                    {flags[i] ? <Icon name="check" size={9} color={colors.onAccent} strokeWidth={3} /> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.block]}>
          <WeightChart entries={weights} />
        </View>

        <View style={[styles.card, styles.block]}>
          <Text style={styles.cardLabel}>Daily Average Calories</Text>
          {average ? (
            <>
              <View style={styles.averageRow}>
                <Text style={styles.bigValue}>{average.kcal}</Text>
                <Text style={styles.averageUnit}>kcal / day</Text>
                {average.percent !== null ? (
                  <View style={styles.percentPill}>
                    <Text style={[styles.percentPillText, { color: progressColor(average.percent) }]}>{average.percent}% of goal</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardHint}>
                Last {AVERAGE_WINDOW_DAYS} days, {average.days} {average.days === 1 ? 'day' : 'days'} logged
              </Text>
            </>
          ) : (
            <Text style={[styles.cardHint, styles.spaced]}>Log a few meals to see your daily average.</Text>
          )}
        </View>

        <View style={[styles.card, styles.block]}>
          <View style={styles.monthNav}>
            <Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.navButton}>
              <Icon name="back" size={16} color={colors.text} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable
              accessibilityLabel="Next month"
              disabled={atCurrentMonth}
              onPress={() => changeMonth(1)}
              style={[styles.navButton, atCurrentMonth && styles.navDisabled]}
            >
              <View style={styles.flip}>
                <Icon name="back" size={16} color={colors.text} />
              </View>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          {weeks.map((week, w) => (
            <View key={w} style={styles.weekRow}>
              {week.map((key, i) => {
                if (!key) return <View key={i} style={styles.cell} />;
                const totals = dayTotals[key];
                const percent = totals ? percentOfGoal(totals.calories, goals.calories) : null;
                const future = key > todayKey;
                const isSelected = key === selected;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${key}${totals ? `, ${Math.round(totals.calories)} kcal` : ', nothing logged'}`}
                    disabled={future}
                    onPress={() => setSelected(key)}
                    style={[styles.cell, styles.cellFilled, isSelected && styles.cellSelected, future && styles.cellFuture]}
                  >
                    <Text style={[styles.cellDay, key === todayKey && styles.cellDayToday, isSelected && styles.cellDaySelected]}>
                      {Number(key.slice(8))}
                    </Text>
                    {totals ? <Text style={[styles.cellKcal, isSelected && styles.cellDaySelected]}>{Math.round(totals.calories)}</Text> : null}
                    {percent !== null ? (
                      <Text style={[styles.cellPercent, { color: isSelected ? colors.onAccent : progressColor(percent) }]}>{percent}%</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {loadError ? <Text style={styles.empty}>Could not load this month. Switch tabs and back to retry.</Text> : null}
        </View>

        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayTitle}>{formatDayLabel(selected)}</Text>
            <Text style={styles.daySub}>{selected}</Text>
          </View>
          <View style={styles.dayStats}>
            <Text style={styles.dayKcal}>{Math.round(selectedTotals.calories)} kcal</Text>
            <Text style={styles.daySub}>{selectedPercent === null ? '' : `${selectedPercent}% of ${Math.round(goals.calories)}`}</Text>
          </View>
        </View>

        {selectedLog.length === 0 ? (
          <Text style={styles.empty}>Nothing logged this day.</Text>
        ) : (
          selectedLog.map((item) =>
            item.kind === 'meal' ? (
              <MealRow key={item.meal.id} meal={item.meal} onPress={(m) => router.push({ pathname: '/meal', params: { id: m.id } })} />
            ) : (
              <WeightRow key={item.entry.id} entry={item.entry} onPress={(e) => router.push({ pathname: '/weight', params: { id: e.id } })} />
            ),
          )
        )}

        <View style={styles.actions}>
          <Button label={`+  Add to ${formatDayLabel(selected)}`} onPress={() => setMenuOpen(true)} />
        </View>
      </ScrollView>

      <AddMenu visible={menuOpen} dayLabel={formatDayLabel(selected)} onClose={() => setMenuOpen(false)} onSelect={handleAdd} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 560 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, ...shadow.card },
  block: { marginBottom: 12 },
  pressed: { opacity: 0.8 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, minWidth: 0 },
  cardLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  cardHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  spaced: { marginTop: 8 },
  bigValue: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 6 },
  logWeight: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  logWeightText: { color: colors.onAccent, fontSize: 13, fontWeight: '600' },
  streakCard: { alignItems: 'center', paddingHorizontal: 10 },
  flameWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  flameCount: { position: 'absolute', top: 26, color: colors.card, fontSize: 20, fontWeight: '800' },
  streakLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
  streakDays: { flexDirection: 'row', gap: 3, marginTop: 10 },
  streakDay: { alignItems: 'center', gap: 3 },
  streakLetter: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  streakDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  streakDotOn: { backgroundColor: colors.streak },
  averageRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  averageUnit: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  percentPill: { marginLeft: 'auto', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'center' },
  percentPillText: { fontSize: 12, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  navButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  navDisabled: { opacity: 0.3 },
  flip: { transform: [{ scaleX: -1 }] },
  weekRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '600' },
  // Compact: empty days are a slim chip; days with entries grow just enough for kcal and percent.
  cell: { flex: 1 },
  cellFilled: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingVertical: 3,
  },
  cellSelected: { backgroundColor: colors.accent },
  cellFuture: { opacity: 0.3 },
  cellDay: { color: colors.text, fontSize: 13, fontWeight: '600' },
  cellDayToday: { color: colors.streak },
  cellDaySelected: { color: colors.onAccent, fontWeight: '700' },
  cellKcal: { color: colors.muted, fontSize: 10, marginTop: 2 },
  cellPercent: { fontSize: 10, fontWeight: '700' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.sm, marginBottom: spacing.sm },
  dayTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  daySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dayStats: { alignItems: 'flex-end' },
  dayKcal: { color: colors.text, fontSize: 18, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: spacing.md },
  actions: { marginTop: spacing.md },
});

import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddMenu, type AddChoice } from '@/components/AddMenu';
import { CalorieHero } from '@/components/CalorieHero';
import { Icon } from '@/components/Icon';
import { MacroCard } from '@/components/MacroCard';
import { MealRow } from '@/components/MealRow';
import { AddedBadge } from '@/components/Reward';
import { WeekStrip } from '@/components/WeekStrip';
import { WeightRow } from '@/components/WeightRow';
import {
  DEFAULT_GOALS,
  dayKey,
  formatDayLabel,
  parseDayKey,
  repositories,
  resolveDay,
  sumMeals,
  type Goals,
  type Meal,
  type WeightEntry,
  useDataVersion,
} from '@/data';
import { mergeLog } from '@/lib/log';
import { useRecentMeals } from '@/lib/useRecentMeals';
import { colors, radius, shadow, spacing } from '@/theme';

export default function TodayScreen() {
  const params = useLocalSearchParams<{ day?: string; celebrate?: string; added?: string }>();
  const today = dayKey(new Date());
  const day = resolveDay(params.day);
  const isToday = day === today;
  const dataVersion = useDataVersion();
  const { loggedDays, streak } = useRecentMeals(today);

  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, m, w] = await Promise.all([
        repositories.goals.getGoals(),
        repositories.meals.listMealsForDay(day),
        repositories.weights.listWeightsForDay(day),
      ]);
      setGoals(g);
      setMeals(m);
      setWeights(w);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion only triggers a reload
  }, [day, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Reward: a success haptic each time a meal has just been saved.
  useEffect(() => {
    if (params.celebrate && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [params.celebrate]);

  const totals = useMemo(() => sumMeals(meals), [meals]);
  const log = useMemo(() => mergeLog(meals, weights), [meals, weights]);
  const goTo = (key: string) => router.setParams({ day: key });
  const dayLabel = formatDayLabel(day);
  const fullDate = parseDayKey(day)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  function handleAdd(choice: AddChoice) {
    setMenuOpen(false);
    const target = choice === 'photo' ? '/capture' : choice === 'manual' ? '/meal' : '/weight';
    router.push({ pathname: target, params: { day } });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Icon name="brand" size={20} color={colors.onAccent} />
            </View>
            <Text style={styles.brandText}>Cal Tracker</Text>
          </View>
          <View accessibilityLabel={`${streak} day streak`} style={styles.streak}>
            <Icon name="flame" size={16} color={colors.streak} filled />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        </View>

        <WeekStrip day={day} today={today} loggedDays={loggedDays} onSelect={goTo} />

        {!isToday ? (
          <View style={styles.pastRow}>
            <Text style={styles.pastText} numberOfLines={1}>
              {fullDate}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => goTo(today)} style={styles.todayPill}>
              <Text style={styles.todayPillText}>Jump to today</Text>
            </Pressable>
          </View>
        ) : null}

        <CalorieHero
          eaten={totals.calories}
          goal={goals.calories}
          overlay={<AddedBadge triggerKey={params.celebrate} amount={Number(params.added)} />}
        />

        <View style={styles.macros}>
          <MacroCard label="Protein" icon="protein" value={totals.proteinG} goal={goals.proteinG} color={colors.protein} />
          <MacroCard label="Carbs" icon="carbs" value={totals.carbsG} goal={goals.carbsG} color={colors.carbs} />
          <MacroCard label="Fat" icon="fat" value={totals.fatG} goal={goals.fatG} color={colors.fat} />
        </View>

        <Text style={styles.sectionTitle}>Recently logged</Text>
        {loadError ? (
          <Text style={styles.empty}>Could not load this day. Switch tabs and back to retry.</Text>
        ) : log.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isToday ? 'Nothing logged yet. Tap + to add your first meal.' : 'Nothing logged this day. Tap + to add a missed meal.'}
            </Text>
          </View>
        ) : (
          log.map((item) =>
            item.kind === 'meal' ? (
              <MealRow key={item.meal.id} meal={item.meal} onPress={(m) => router.push({ pathname: '/meal', params: { id: m.id } })} />
            ) : (
              <WeightRow key={item.entry.id} entry={item.entry} onPress={(e) => router.push({ pathname: '/weight', params: { id: e.id } })} />
            ),
          )
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Icon name="plus" size={28} color={colors.onAccent} strokeWidth={2.2} />
        </Pressable>
      </View>

      <AddMenu visible={menuOpen} dayLabel={dayLabel} onClose={() => setMenuOpen(false)} onSelect={handleAdd} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  content: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 110, width: '100%', maxWidth: 560 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 7, ...shadow.card },
  streakText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  pastText: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: '600' },
  todayPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: colors.accent },
  todayPillText: { color: colors.onAccent, fontWeight: '600', fontSize: 13 },
  macros: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: spacing.md },
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.card },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  fabWrap: { position: 'absolute', left: 0, right: 0, bottom: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'flex-end', paddingRight: spacing.md },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  fabPressed: { opacity: 0.85 },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, NumberField } from '@/components/ui';
import { repositories, type ActivityLevel, type Goal, type Sex } from '@/data';
import { buildProfile, calculateTargets } from '@/lib/targets';
import { colors, radius, spacing } from '@/theme';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
  { value: 'muscle', label: 'Build muscle' },
];

const SEXES: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ACTIVITIES: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentary', hint: 'Desk job, little exercise' },
  { value: 'light', label: 'Lightly active', hint: 'Exercise 1–3 days a week' },
  { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5 days a week' },
  { value: 'active', label: 'Very active', hint: 'Hard exercise 6–7 days a week' },
  { value: 'very_active', label: 'Athlete', hint: 'Physical job or twice-daily training' },
];

const nowMs = () => Date.now();

function leave(recalc: boolean) {
  if (recalc && router.canGoBack()) router.back();
  else router.replace('/');
}

/** First-run questions (or "Recalculate goals" with `?mode=recalc`) that set daily calorie and macro targets. */
export default function OnboardingScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const recalc = mode === 'recalc';

  const [goal, setGoal] = useState<Goal | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('70');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!recalc) return;
    let cancelled = false;
    repositories.profile.getProfile().then(
      (p) => {
        if (cancelled || !p) return;
        setGoal(p.goal);
        setSex(p.sex);
        setActivity(p.activity);
        setAge(String(p.age));
        setHeightCm(String(p.heightCm));
        setWeightKg(String(p.weightKg));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [recalc]);

  const profile = useMemo(
    () => buildProfile({ goal, sex, activity, age, heightCm, weightKg }),
    [goal, sex, activity, age, heightCm, weightKg],
  );
  const targets = useMemo(() => (profile ? calculateTargets(profile) : null), [profile]);

  async function finish() {
    if (!profile || !targets || saving) return;
    setSaving(true);
    setError('');
    try {
      await repositories.goals.setGoals(targets);
      await repositories.profile.completeOnboarding(profile);
      const weights = await repositories.weights.listWeights();
      const latest = weights[weights.length - 1];
      if (!latest || latest.kg !== profile.weightKg) {
        await repositories.weights.addWeight({ kg: profile.weightKg, loggedAt: nowMs() });
      }
      leave(recalc);
    } catch {
      setError('Could not save your goals. Please try again.');
      setSaving(false);
    }
  }

  async function skip() {
    try {
      await repositories.profile.completeOnboarding(null);
    } finally {
      leave(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{recalc ? 'Recalculate your goals' : "Let's set your goals"}</Text>
        <Text style={styles.sub}>A few questions to work out your daily calories and macros.</Text>

        <Text style={styles.label}>YOUR GOAL</Text>
        <View style={styles.wrap}>
          {GOALS.map((g) => (
            <Chip key={g.value} label={g.label} selected={goal === g.value} onPress={() => setGoal(g.value)} />
          ))}
        </View>

        <Text style={styles.label}>SEX</Text>
        <View style={styles.wrap}>
          {SEXES.map((s) => (
            <Chip key={s.value} label={s.label} selected={sex === s.value} onPress={() => setSex(s.value)} />
          ))}
        </View>

        <View style={styles.numbers}>
          <NumberField label="AGE" unit="yrs" color={colors.muted} step={1} value={age} onChangeText={setAge} />
          <NumberField label="HEIGHT" unit="cm" color={colors.muted} step={1} value={heightCm} onChangeText={setHeightCm} />
          <NumberField label="WEIGHT" unit="kg" color={colors.muted} step={0.5} value={weightKg} onChangeText={setWeightKg} />
        </View>

        <Text style={styles.label}>ACTIVITY LEVEL</Text>
        <View style={styles.column}>
          {ACTIVITIES.map((a) => (
            <Chip key={a.value} label={a.label} hint={a.hint} selected={activity === a.value} onPress={() => setActivity(a.value)} />
          ))}
        </View>

        {targets ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>YOUR DAILY TARGET</Text>
            <Text style={styles.resultKcal}>
              {targets.calories}
              <Text style={styles.resultUnit}> kcal</Text>
            </Text>
            <View style={styles.macros}>
              <Macro label="Protein" grams={targets.proteinG} color={colors.protein} />
              <Macro label="Carbs" grams={targets.carbsG} color={colors.carbs} />
              <Macro label="Fat" grams={targets.fatG} color={colors.fat} />
            </View>
            <Text style={styles.note}>Estimated with the Mifflin-St Jeor equation. You can fine-tune these later in Settings.</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Choose a goal, sex and activity level, and enter a realistic age, height and weight to see your targets.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={recalc ? 'Save new goals' : 'Start tracking'} onPress={() => void finish()} disabled={!profile || saving} />
        {recalc ? (
          <Button label="Cancel" variant="ghost" onPress={() => leave(true)} />
        ) : (
          <Button label="Skip for now" variant="ghost" onPress={() => void skip()} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }]}>{grams} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, width: '100%', maxWidth: 560 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.lg },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  column: { gap: spacing.sm },
  numbers: { marginTop: spacing.lg },
  result: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  resultLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  resultKcal: { color: colors.text, fontSize: 44, fontWeight: '700', marginTop: spacing.xs },
  resultUnit: { color: colors.muted, fontSize: 18, fontWeight: '500' },
  macros: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg },
  macro: { flex: 1 },
  macroValue: { fontSize: 20, fontWeight: '700' },
  macroLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  note: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  hint: { color: colors.muted, fontSize: 14, marginTop: spacing.lg },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
  footer: { width: '100%', maxWidth: 560, padding: spacing.lg, gap: spacing.sm },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button, NumberField } from '@/components/ui';
import { repositories, useDataVersion, type Profile, type Reminder } from '@/data';
import { newId } from '@/data/validation';
import { parseAmount } from '@/lib/nutrition';
import { syncReminders } from '@/lib/reminders';
import { formatTime, parseTime } from '@/lib/time';
import { colors, radius, shadow, spacing } from '@/theme';

type Draft = { id: string; name: string; time: string; enabled: boolean };
type GoalsForm = { calories: string; proteinG: string; carbsG: string; fatG: string };

// Reminder ids must be UUIDs so they are valid rows in the database.
const newDraftId = newId;

const GOAL_LABEL = { lose: 'Lose weight', maintain: 'Maintain weight', gain: 'Gain weight', muscle: 'Build muscle' } as const;

function describeProfile(p: Profile): string {
  return `${GOAL_LABEL[p.goal]} · ${p.weightKg} kg · ${p.heightCm} cm · ${p.age} yrs`;
}

export default function SettingsScreen() {
  const [goals, setGoals] = useState<GoalsForm>({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const auth = useAuth();
  const dataVersion = useDataVersion();
  const [accountMessage, setAccountMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const [g, r, p] = await Promise.all([
            repositories.goals.getGoals(),
            repositories.reminders.getReminders(),
            repositories.profile.getProfile(),
          ]);
          if (cancelled) return;
          setGoals({
            calories: String(g.calories),
            proteinG: String(g.proteinG),
            carbsG: String(g.carbsG),
            fatG: String(g.fatG),
          });
          setDrafts(r.map((x) => ({ id: x.id, name: x.name, time: formatTime(x), enabled: x.enabled })));
          setProfile(p);
          setStatus('');
        } catch {
          if (!cancelled) setStatus('Could not load your settings.');
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion only triggers a reload
    }, [dataVersion]),
  );

  const calories = parseAmount(goals.calories);
  const proteinG = parseAmount(goals.proteinG);
  const carbsG = parseAmount(goals.carbsG);
  const fatG = parseAmount(goals.fatG);
  const goalsValid = calories !== null && calories > 0 && proteinG !== null && carbsG !== null && fatG !== null;
  const remindersValid = drafts.every((d) => d.name.trim() !== '' && parseTime(d.time) !== null);
  const canSave = goalsValid && remindersValid && !saving;

  const setGoal = (key: keyof GoalsForm) => (text: string) => setGoals((g) => ({ ...g, [key]: text }));
  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  async function handleSignOut() {
    setAccountMessage('');
    const error = await auth.signOut();
    if (error) setAccountMessage(error);
  }

  async function save() {
    if (!canSave || calories === null || proteinG === null || carbsG === null || fatG === null) return;
    setSaving(true);
    setStatus('');
    try {
      const reminders: Reminder[] = drafts.map((d) => {
        const t = parseTime(d.time) ?? { hour: 0, minute: 0 };
        return { id: d.id, name: d.name.trim(), hour: t.hour, minute: t.minute, enabled: d.enabled };
      });
      await repositories.goals.setGoals({ calories, proteinG, carbsG, fatG });
      await repositories.reminders.setReminders(reminders);
      const result = await syncReminders(reminders);
      const anyEnabled = reminders.some((r) => r.enabled);
      if (!anyEnabled || result.status === 'scheduled') {
        setStatus(
          result.status === 'scheduled' && result.count > 0
            ? `Saved. ${result.count} reminder${result.count === 1 ? '' : 's'} scheduled daily.`
            : 'Saved.',
        );
      } else if (result.status === 'denied') {
        setStatus('Saved, but notifications are blocked. Allow them in your device settings.');
      } else if (result.status === 'unsupported') {
        setStatus('Saved. Reminders only fire on phones (iOS/Android), not in the browser.');
      } else {
        setStatus('Saved, but scheduling reminders failed.');
      }
    } catch {
      setStatus('Could not save your settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Settings</Text>

        {auth.isConfigured ? (
          <>
            <Text style={styles.section}>Account</Text>
            <View style={styles.profile}>
              <Text style={styles.profileText}>{auth.email ?? 'Signed in'}</Text>
              {accountMessage ? <Text style={styles.error}>{accountMessage}</Text> : null}
              <Button label="Sign out" variant="ghost" onPress={() => void handleSignOut()} />
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Profile</Text>
        <View style={styles.profile}>
          <Text style={styles.profileText}>
            {profile ? describeProfile(profile) : 'No profile yet. Answer a few questions to calculate your targets.'}
          </Text>
          <Button
            label={profile ? 'Recalculate goals' : 'Calculate my goals'}
            variant="ghost"
            onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'recalc' } })}
          />
        </View>

        <Text style={styles.section}>Daily goals</Text>
        <NumberField label="CALORIES" unit="kcal" color={colors.calories} step={50} value={goals.calories} onChangeText={setGoal('calories')} />
        <NumberField label="PROTEIN" unit="g" color={colors.protein} step={5} value={goals.proteinG} onChangeText={setGoal('proteinG')} />
        <NumberField label="CARBS" unit="g" color={colors.carbs} step={5} value={goals.carbsG} onChangeText={setGoal('carbsG')} />
        <NumberField label="FAT" unit="g" color={colors.fat} step={5} value={goals.fatG} onChangeText={setGoal('fatG')} />

        <Text style={styles.section}>Meal reminders</Text>
        {Platform.OS === 'web' ? (
          <Text style={styles.note}>You can set reminders here, but they only fire on phones. Browsers can&apos;t schedule them.</Text>
        ) : null}
        {drafts.length === 0 ? <Text style={styles.note}>No reminders yet.</Text> : null}
        {drafts.map((d) => {
          const nameBad = d.name.trim() === '';
          const timeBad = parseTime(d.time) === null;
          return (
            <View key={d.id} style={styles.reminder}>
              <Switch
                accessibilityLabel={`${d.name || 'Reminder'} enabled`}
                value={d.enabled}
                onValueChange={(enabled) => updateDraft(d.id, { enabled })}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
              <TextInput
                accessibilityLabel="Reminder name"
                value={d.name}
                onChangeText={(name) => updateDraft(d.id, { name })}
                placeholder="Name"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.nameInput, nameBad && styles.invalid]}
              />
              <TextInput
                accessibilityLabel="Reminder time, 24 hour HH:MM"
                value={d.time}
                onChangeText={(time) => updateDraft(d.id, { time })}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={[styles.input, styles.timeInput, timeBad && styles.invalid]}
              />
              <Pressable
                accessibilityLabel={`Delete ${d.name || 'reminder'}`}
                hitSlop={8}
                onPress={() => setDrafts((list) => list.filter((x) => x.id !== d.id))}
                style={styles.delete}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          );
        })}
        {!remindersValid ? <Text style={styles.error}>Each reminder needs a name and a 24-hour time like 08:30.</Text> : null}
        <Button
          label="+  Add reminder"
          variant="ghost"
          onPress={() => setDrafts((list) => [...list, { id: newDraftId(), name: 'Reminder', time: '12:00', enabled: true }])}
        />

        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={saving ? 'Saving…' : 'Save settings'} onPress={() => void save()} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  scroll: { width: '100%' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: spacing.md },
  section: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  note: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  profile: { gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  profileText: { color: colors.muted, fontSize: 14 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  nameInput: { flex: 1 },
  timeInput: { width: 76, textAlign: 'center' },
  invalid: { borderColor: colors.danger },
  delete: { paddingHorizontal: spacing.xs },
  deleteText: { color: colors.muted, fontSize: 16 },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  status: { color: colors.success, fontSize: 14, marginTop: spacing.md },
  footer: { width: '100%', maxWidth: 560, padding: spacing.md },
});

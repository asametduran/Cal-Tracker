import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, NumberField } from '@/components/ui';
import { formatDayLabel, loggedAtForDay, repositories, resolveDay, type WeightEntry } from '@/data';
import { parseAmount } from '@/lib/nutrition';
import { colors, spacing } from '@/theme';

const FALLBACK_KG = '70';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Log a weigh-in for a day (`?day=`), or view/edit/delete one (`?id=`). */
export default function WeightScreen() {
  const { id, day } = useLocalSearchParams<{ id?: string; day?: string }>();
  const targetDay = resolveDay(day);

  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [entry, setEntry] = useState<WeightEntry | null>(null);
  const [kg, setKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (id) {
        const found = await repositories.weights.getWeight(id);
        if (cancelled) return;
        if (!found) {
          setState('missing');
          return;
        }
        setEntry(found);
        setKg(String(found.kg));
        setState('ready');
        return;
      }
      // New entry: start from the most recent weight, then the profile weight.
      const all = await repositories.weights.listWeights();
      const profile = all.length === 0 ? await repositories.profile.getProfile() : null;
      if (cancelled) return;
      setKg(all.length > 0 ? String(all[all.length - 1].kg) : profile ? String(profile.weightKg) : FALLBACK_KG);
      setState('ready');
    }
    load().catch(() => {
      if (!cancelled) setState(id ? 'missing' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const amount = parseAmount(kg);
  const valid = amount !== null && amount > 0 && amount <= 500;

  async function save() {
    if (!valid || amount === null || saving) return;
    setSaving(true);
    setError('');
    try {
      if (id) {
        const updated = await repositories.weights.updateWeight(id, amount);
        if (!updated) {
          setState('missing');
          setSaving(false);
          return;
        }
      } else {
        await repositories.weights.addWeight({ kg: amount, loggedAt: loggedAtForDay(targetDay) });
      }
      leave();
    } catch {
      setError('Could not save this weight. Please try again.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await repositories.weights.deleteWeight(id);
      leave();
    } catch {
      setError('Could not delete this weight. Please try again.');
    }
  }

  if (state === 'missing') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <Text style={styles.title}>Entry not found</Text>
          <Text style={styles.sub}>It may have been deleted.</Text>
        </View>
        <View style={styles.footer}>
          <Button label="Back" onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  const dayLabel = formatDayLabel(entry?.day ?? targetDay);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{id ? 'Edit weight' : 'Log weight'}</Text>
        <Text style={styles.sub}>{id ? `Logged ${dayLabel}` : `For ${dayLabel}`}</Text>
        {state === 'loading' ? (
          <Text style={styles.sub}>Loading…</Text>
        ) : (
          <NumberField label="WEIGHT" unit="kg" color={colors.weight} step={0.1} value={kg} onChangeText={setKg} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Save" onPress={() => void save()} disabled={state !== 'ready' || !valid || saving} />
        {id ? (
          <Button
            label={confirmDelete ? 'Tap again to delete' : 'Delete entry'}
            variant="danger"
            onPress={() => void remove()}
            disabled={state !== 'ready'}
          />
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={leave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  content: { padding: spacing.lg, width: '100%', maxWidth: 560 },
  body: { flex: 1, width: '100%', maxWidth: 560, padding: spacing.lg, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  footer: { width: '100%', maxWidth: 560, padding: spacing.lg, gap: spacing.sm },
});

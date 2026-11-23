import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealDetail } from '@/components/MealDetail';
import { Button } from '@/components/ui';
import { formatDayLabel, loggedAtForDay, repositories, resolveDay, type Meal } from '@/data';
import { validateMealForm, type MealForm } from '@/lib/nutrition';
import { colors, spacing } from '@/theme';

const BLANK_FORM: MealForm = { title: '', calories: '0', proteinG: '0', carbsG: '0', fatG: '0' };

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

function toForm(meal: Meal): MealForm {
  return {
    title: meal.title,
    calories: oneDecimal(meal.calories),
    proteinG: oneDecimal(meal.proteinG),
    carbsG: oneDecimal(meal.carbsG),
    fatG: oneDecimal(meal.fatG),
  };
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** View, edit or delete a saved meal (`?id=`), or add one manually to a day (`?day=`). */
export default function MealScreen() {
  const { id, day } = useLocalSearchParams<{ id?: string; day?: string }>();
  const targetDay = resolveDay(day);

  const [state, setState] = useState<'loading' | 'ready' | 'missing'>(id ? 'loading' : 'ready');
  const [meal, setMeal] = useState<Meal | null>(null);
  const [form, setForm] = useState<MealForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    repositories.meals.getMeal(id).then(
      (found) => {
        if (cancelled) return;
        if (!found) {
          setState('missing');
          return;
        }
        setMeal(found);
        setForm(toForm(found));
        setState('ready');
      },
      () => {
        if (!cancelled) setState('missing');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const valid = useMemo(() => validateMealForm(form), [form]);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      if (id) {
        const updated = await repositories.meals.updateMeal(id, valid);
        if (!updated) {
          setState('missing');
          setSaving(false);
          return;
        }
      } else {
        await repositories.meals.addMeal({ ...valid, loggedAt: loggedAtForDay(targetDay) });
      }
      leave();
    } catch {
      setError('Could not save this meal. Please try again.');
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
      await repositories.meals.deleteMeal(id);
      leave();
    } catch {
      setError('Could not delete this meal. Please try again.');
    }
  }

  if (state === 'missing') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <Text style={styles.title}>Meal not found</Text>
          <Text style={styles.muted}>It may have been deleted.</Text>
        </View>
        <View style={styles.footer}>
          <Button label="Back" onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  const dayLabel = formatDayLabel(meal?.day ?? targetDay);

  return (
    <MealDetail
      photoUri={meal?.photoUri}
      caption={id ? `Logged ${dayLabel}` : `Adding to ${dayLabel}`}
      onBack={leave}
      form={form}
      onChange={(key, text) => setForm((f) => ({ ...f, [key]: text }))}
      status={state === 'loading' ? 'loading' : 'ready'}
      statusMessage="Loading…"
      errorText={error}
      secondary={
        id
          ? { label: confirmDelete ? 'Tap again to delete' : 'Delete', onPress: () => void remove(), tone: 'danger', disabled: state !== 'ready' }
          : { label: 'Cancel', onPress: leave }
      }
      primary={{ label: saving ? 'Saving…' : 'Done', onPress: () => void save(), disabled: state !== 'ready' || !valid || saving }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: 560, padding: spacing.lg, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  footer: { width: '100%', maxWidth: 560, padding: spacing.lg, gap: spacing.sm },
});

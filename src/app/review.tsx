import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { analyzeMeal } from '@/ai/analyzeMeal';
import { AnalyzeError } from '@/ai/types';
import { MealDetail } from '@/components/MealDetail';
import { formatDayLabel, loggedAtForDay, repositories, resolveDay } from '@/data';
import { makeThumbnail } from '@/lib/image';
import { formatEstimate, validateMealForm, type MealForm } from '@/lib/nutrition';
import { clearPendingPhoto, getPendingPhoto } from '@/state/pendingPhoto';

const BLANK_FORM: MealForm = { title: '', calories: '0', proteinG: '0', carbsG: '0', fatG: '0' };

/** Fresh value each save so Home can tell one celebration from the next. */
const newCelebrationToken = () => String(Date.now());

export default function ReviewScreen() {
  const photo = getPendingPhoto();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const targetDay = resolveDay(day);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState<MealForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    analyzeMeal(photo).then(
      (estimate) => {
        if (cancelled) return;
        setForm(formatEstimate(estimate));
        setStatus('ready');
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof AnalyzeError ? e.message : 'Something went wrong analysing the photo.');
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [photo, attempt]);

  const valid = useMemo(() => validateMealForm(form), [form]);

  if (!photo) return <Redirect href="/" />;

  function cancel() {
    clearPendingPhoto();
    router.dismissTo({ pathname: '/', params: { day: targetDay } });
  }

  function reanalyze() {
    setStatus('loading');
    setAttempt((a) => a + 1);
  }

  async function save() {
    if (!valid || saving || !photo) return;
    setSaving(true);
    setSaveError('');
    try {
      const photoUri = await makeThumbnail(photo.uri);
      await repositories.meals.addMeal({ ...valid, loggedAt: loggedAtForDay(targetDay), photoUri });
      clearPendingPhoto();
      router.dismissTo({
        pathname: '/',
        params: { day: targetDay, celebrate: newCelebrationToken(), added: String(Math.round(valid.calories)) },
      });
    } catch {
      setSaveError('Could not save this meal. Please try again.');
      setSaving(false);
    }
  }

  return (
    <MealDetail
      key={attempt}
      photoUri={photo.uri}
      caption={`Logging for ${formatDayLabel(targetDay)}`}
      onBack={cancel}
      form={form}
      onChange={(key, text) => setForm((f) => ({ ...f, [key]: text }))}
      status={status}
      statusMessage={status === 'error' ? error : undefined}
      onRetry={reanalyze}
      onManual={() => {
        setForm(BLANK_FORM);
        setStatus('ready');
      }}
      errorText={saveError}
      secondary={{ label: 'Fix Results', onPress: reanalyze, disabled: status === 'loading' || saving }}
      primary={{ label: saving ? 'Saving…' : 'Done', onPress: () => void save(), disabled: status !== 'ready' || !valid || saving }}
    />
  );
}

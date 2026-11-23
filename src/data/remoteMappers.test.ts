import {
  mealToRow,
  profileToRow,
  reminderToRow,
  rowToMeal,
  rowToProfile,
  rowToReminder,
  rowToWeight,
  weightToRow,
} from './remoteMappers';
import type { Meal, Profile, WeightEntry } from './types';

const thumb = 'data:image/jpeg;base64,AAAA';
const meal: Meal = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Chicken bowl',
  calories: 640.04,
  proteinG: 42,
  carbsG: 68.26,
  fatG: 22,
  day: '2026-11-23',
  loggedAt: Date.UTC(2026, 10, 23, 10, 18, 5),
  photoUri: thumb,
};

describe('meal mapping', () => {
  it('round-trips a meal, rounding macros to one decimal', () => {
    const row = mealToRow(meal);
    expect(row).toMatchObject({ calories: 640, carbs_g: 68.3, day: '2026-11-23', thumbnail: thumb });
    expect(row.logged_at).toBe('2026-11-23T10:18:05.000Z');
    expect(rowToMeal(row)).toEqual({ ...meal, calories: 640, carbsG: 68.3 });
  });

  it('handles numeric strings from the API and a missing thumbnail', () => {
    const m = rowToMeal({ ...mealToRow({ ...meal, photoUri: undefined }), calories: '641.5', fat_g: '9.0' });
    expect(m.calories).toBe(641.5);
    expect(m.fatG).toBe(9);
    expect(m.photoUri).toBeUndefined();
  });

  it('never uploads local file URIs, non-JPEG data or oversized thumbnails', () => {
    expect(mealToRow({ ...meal, photoUri: 'file:///x.jpg' }).thumbnail).toBeNull();
    expect(mealToRow({ ...meal, photoUri: 'blob:http://x/1' }).thumbnail).toBeNull();
    expect(mealToRow({ ...meal, photoUri: 'data:image/png;base64,AAAA' }).thumbnail).toBeNull();
    expect(mealToRow({ ...meal, photoUri: `data:image/jpeg;base64,${'A'.repeat(200_001)}` }).thumbnail).toBeNull();
  });
});

describe('weight and reminder mapping', () => {
  it('round-trips a weight entry', () => {
    const entry: WeightEntry = { id: '22222222-2222-4222-8222-222222222222', day: '2026-11-23', loggedAt: 1_700_000_000_000, kg: 80.44 };
    expect(rowToWeight(weightToRow(entry))).toEqual({ ...entry, kg: 80.4 });
  });

  it('round-trips a reminder with its sort order', () => {
    const r = { id: '33333333-3333-4333-8333-333333333333', name: 'Lunch', hour: 12, minute: 30, enabled: true };
    const row = reminderToRow(r, 4);
    expect(row.sort_order).toBe(4);
    expect(rowToReminder(row)).toEqual(r);
  });
});

describe('profile mapping', () => {
  const profile: Profile = { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' };
  const goals = { calories: 2259, proteinG: 160, carbsG: 263, fatG: 63 };

  it('round-trips profile state and targets', () => {
    const row = profileToRow('user-1', { onboarded: true, profile }, goals);
    expect(row).toMatchObject({ id: 'user-1', onboarded: true, goal: 'lose', target_calories: 2259 });
    expect(rowToProfile(row)).toEqual({ state: { onboarded: true, profile }, goals });
  });

  it('writes nulls for a skipped onboarding and reads them back as no profile', () => {
    const row = profileToRow('user-1', { onboarded: true, profile: null }, goals);
    expect(row.goal).toBeNull();
    expect(rowToProfile(row).state).toEqual({ onboarded: true, profile: null });
  });

  it('treats a missing or fresh row as not onboarded with no goals', () => {
    expect(rowToProfile(null)).toEqual({ state: { onboarded: false, profile: null }, goals: null });
    const fresh = {
      id: 'u', onboarded: false, goal: null, sex: null, age: null, height_cm: null, weight_kg: null,
      activity: null, target_calories: null, target_protein_g: null, target_carbs_g: null, target_fat_g: null,
    };
    expect(rowToProfile(fresh)).toEqual({ state: { onboarded: false, profile: null }, goals: null });
  });
});

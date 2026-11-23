import type { Goals, Meal, Profile, Reminder, WeightEntry } from './types';
import type { ProfileState } from './validation';

// Row shapes as PostgREST returns them. `numeric` columns can arrive as numbers or strings.
type Numeric = number | string;

export type MealRow = {
  id: string;
  title: string;
  calories: Numeric;
  protein_g: Numeric;
  carbs_g: Numeric;
  fat_g: Numeric;
  day: string;
  logged_at: string;
  thumbnail: string | null;
};

export type WeightRow = { id: string; day: string; logged_at: string; kg: Numeric };

export type ReminderRow = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  enabled: boolean;
  sort_order: number;
};

export type ProfileRow = {
  id: string;
  onboarded: boolean;
  goal: Profile['goal'] | null;
  sex: Profile['sex'] | null;
  age: number | null;
  height_cm: Numeric | null;
  weight_kg: Numeric | null;
  activity: Profile['activity'] | null;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};

const THUMBNAIL_PREFIX = 'data:image/jpeg;base64,';
const MAX_THUMBNAIL_CHARS = 200_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The database only stores small JPEG data URIs; anything else (file://, blob:, huge) is dropped. */
function storableThumbnail(uri: string | undefined): string | null {
  return uri && uri.startsWith(THUMBNAIL_PREFIX) && uri.length <= MAX_THUMBNAIL_CHARS ? uri : null;
}

export function mealToRow(meal: Meal): MealRow {
  return {
    id: meal.id,
    title: meal.title,
    calories: round1(meal.calories),
    protein_g: round1(meal.proteinG),
    carbs_g: round1(meal.carbsG),
    fat_g: round1(meal.fatG),
    day: meal.day,
    logged_at: new Date(meal.loggedAt).toISOString(),
    thumbnail: storableThumbnail(meal.photoUri),
  };
}

export function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    title: row.title,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    day: row.day.slice(0, 10),
    loggedAt: Date.parse(row.logged_at),
    photoUri: row.thumbnail ?? undefined,
  };
}

export function weightToRow(entry: WeightEntry): WeightRow {
  return { id: entry.id, day: entry.day, logged_at: new Date(entry.loggedAt).toISOString(), kg: round1(entry.kg) };
}

export function rowToWeight(row: WeightRow): WeightEntry {
  return { id: row.id, day: row.day.slice(0, 10), loggedAt: Date.parse(row.logged_at), kg: Number(row.kg) };
}

export function reminderToRow(reminder: Reminder, sortOrder: number): ReminderRow {
  return {
    id: reminder.id,
    name: reminder.name,
    hour: reminder.hour,
    minute: reminder.minute,
    enabled: reminder.enabled,
    sort_order: sortOrder,
  };
}

export function rowToReminder(row: ReminderRow): Reminder {
  return { id: row.id, name: row.name, hour: row.hour, minute: row.minute, enabled: row.enabled };
}

export function profileToRow(userId: string, state: ProfileState, goals: Goals): ProfileRow {
  const p = state.profile;
  return {
    id: userId,
    onboarded: state.onboarded,
    goal: p?.goal ?? null,
    sex: p?.sex ?? null,
    age: p?.age ?? null,
    height_cm: p ? round1(p.heightCm) : null,
    weight_kg: p ? round1(p.weightKg) : null,
    activity: p?.activity ?? null,
    target_calories: Math.round(goals.calories),
    target_protein_g: Math.round(goals.proteinG),
    target_carbs_g: Math.round(goals.carbsG),
    target_fat_g: Math.round(goals.fatG),
  };
}

/** A missing row, or one with unfilled columns, maps to "not onboarded / no goals yet". */
export function rowToProfile(row: ProfileRow | null): { state: ProfileState; goals: Goals | null } {
  if (!row) return { state: { onboarded: false, profile: null }, goals: null };
  const complete =
    row.goal && row.sex && row.activity && row.age !== null && row.height_cm !== null && row.weight_kg !== null;
  const profile: Profile | null = complete
    ? {
        goal: row.goal!,
        sex: row.sex!,
        activity: row.activity!,
        age: Number(row.age),
        heightCm: Number(row.height_cm),
        weightKg: Number(row.weight_kg),
      }
    : null;
  const hasTargets =
    row.target_calories !== null &&
    row.target_protein_g !== null &&
    row.target_carbs_g !== null &&
    row.target_fat_g !== null;
  const goals: Goals | null = hasTargets
    ? {
        calories: Number(row.target_calories),
        proteinG: Number(row.target_protein_g),
        carbsG: Number(row.target_carbs_g),
        fatG: Number(row.target_fat_g),
      }
    : null;
  return { state: { onboarded: row.onboarded, profile }, goals };
}

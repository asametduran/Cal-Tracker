import type { ActivityLevel, Goal, Goals, Profile, Sex } from '@/data/types';

import { parseAmount } from './nutrition';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Daily calorie adjustment relative to maintenance. */
const GOAL_CALORIE_DELTA: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300, muscle: 250 };

/** Protein per kg of body weight. */
const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 2.0, maintain: 1.6, gain: 1.6, muscle: 2.0 };

/** Never recommend less than this, whatever the goal. */
const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 };

const FAT_SHARE_OF_CALORIES = 0.25;

/** Mifflin-St Jeor basal metabolic rate in kcal/day. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

/** Total daily energy expenditure: BMR scaled by activity level. */
export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTORS[p.activity];
}

/** Daily calorie and macro targets for a profile. Protein by body weight, 25% fat, carbs fill the rest. */
export function calculateTargets(p: Profile): Goals {
  const calories = Math.round(Math.max(MIN_CALORIES[p.sex], tdee(p) + GOAL_CALORIE_DELTA[p.goal]));
  const proteinG = Math.round(p.weightKg * PROTEIN_G_PER_KG[p.goal]);
  const fatG = Math.round((calories * FAT_SHARE_OF_CALORIES) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, carbsG, fatG };
}

export type ProfileInput = {
  goal: Goal | null;
  sex: Sex | null;
  activity: ActivityLevel | null;
  age: string;
  heightCm: string;
  weightKg: string;
};

/** Validates the onboarding form. Returns null until every field is present and in a sane range. */
export function buildProfile(input: ProfileInput): Profile | null {
  const age = parseAmount(input.age);
  const heightCm = parseAmount(input.heightCm);
  const weightKg = parseAmount(input.weightKg);
  if (!input.goal || !input.sex || !input.activity) return null;
  if (age === null || !Number.isInteger(age) || age < 13 || age > 100) return null;
  if (heightCm === null || heightCm < 100 || heightCm > 250) return null;
  if (weightKg === null || weightKg < 30 || weightKg > 300) return null;
  return { goal: input.goal, sex: input.sex, activity: input.activity, age, heightCm, weightKg };
}

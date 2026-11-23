import type { MealEstimate } from '@/ai/types';
import type { Macros } from '@/data/types';

export type MealForm = {
  title: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export type ValidMeal = Macros & { title: string };

/** Non-negative finite number from user text, or null. Accepts comma decimals. */
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function validateMealForm(form: MealForm): ValidMeal | null {
  const title = form.title.trim();
  const calories = parseAmount(form.calories);
  const proteinG = parseAmount(form.proteinG);
  const carbsG = parseAmount(form.carbsG);
  const fatG = parseAmount(form.fatG);
  if (!title || calories === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }
  return { title, calories, proteinG, carbsG, fatG };
}

export function formatEstimate(estimate: MealEstimate): MealForm {
  return {
    title: estimate.title,
    calories: String(Math.round(estimate.calories)),
    proteinG: String(Math.round(estimate.proteinG)),
    carbsG: String(Math.round(estimate.carbsG)),
    fatG: String(Math.round(estimate.fatG)),
  };
}

/** Adds `delta` to the number in `text` (unparseable counts as 0), floored at 0. */
export function stepAmount(text: string, delta: number): string {
  const current = parseAmount(text) ?? 0;
  return String(Math.max(0, Math.round((current + delta) * 10) / 10));
}

export function progressFraction(value: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return Math.min(1, Math.max(0, value / goal));
}

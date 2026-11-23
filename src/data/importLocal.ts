import { DEFAULT_REMINDERS, type Repositories } from './types';
import { newId } from './validation';

const EARLIEST_DAY = '0000-01-01';
const LATEST_DAY = '9999-12-31';

export type ImportResult = { meals: number; weights: number; settings: boolean };

/** True when the device-only store holds anything worth carrying into a new account. */
export async function hasLocalData(source: Repositories): Promise<boolean> {
  if (await source.profile.isOnboarded()) return true;
  if ((await source.weights.listWeights()).length > 0) return true;
  return (await source.meals.listMealsForRange(EARLIEST_DAY, LATEST_DAY)).length > 0;
}

function remindersCustomized(list: { name: string; hour: number; minute: number; enabled: boolean }[]): boolean {
  if (list.length !== DEFAULT_REMINDERS.length) return true;
  return list.some((r, i) => {
    const d = DEFAULT_REMINDERS[i];
    return r.enabled || r.name !== d.name || r.hour !== d.hour || r.minute !== d.minute;
  });
}

/**
 * Copies data from the device-only (pre-account) store into the signed-in account's repositories,
 * giving everything fresh UUIDs. The source is left untouched.
 */
export async function importLocalData(source: Repositories, target: Repositories): Promise<ImportResult> {
  const meals = await source.meals.listMealsForRange(EARLIEST_DAY, LATEST_DAY);
  for (const meal of meals) {
    await target.meals.addMeal({
      title: meal.title,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      loggedAt: meal.loggedAt,
      photoUri: meal.photoUri,
    });
  }

  const weights = await source.weights.listWeights();
  for (const entry of weights) await target.weights.addWeight({ kg: entry.kg, loggedAt: entry.loggedAt });

  let settings = false;
  if (await source.profile.isOnboarded()) {
    await target.goals.setGoals(await source.goals.getGoals());
    await target.profile.completeOnboarding(await source.profile.getProfile());
    settings = true;
  }

  const reminders = await source.reminders.getReminders();
  if (remindersCustomized(reminders)) {
    await target.reminders.setReminders(reminders.map((r) => ({ ...r, id: newId() })));
    settings = true;
  }

  return { meals: meals.length, weights: weights.length, settings };
}

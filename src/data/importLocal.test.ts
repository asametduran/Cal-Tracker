import { hasLocalData, importLocalData } from './importLocal';
import { createStorageRepositories, type KeyValueStorage } from './repositories.web';
import { isUuid } from './validation';

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const noon = new Date(2026, 10, 23, 12).getTime();
const profile = { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' } as const;

describe('hasLocalData', () => {
  it('is false for a fresh store and true once anything is logged', async () => {
    const source = createStorageRepositories(memoryStorage());
    expect(await hasLocalData(source)).toBe(false);
    await source.weights.addWeight({ kg: 80, loggedAt: noon });
    expect(await hasLocalData(source)).toBe(true);
  });

  it('counts a finished onboarding as data', async () => {
    const source = createStorageRepositories(memoryStorage());
    await source.profile.completeOnboarding(null);
    expect(await hasLocalData(source)).toBe(true);
  });
});

describe('importLocalData', () => {
  it('copies meals, weights, goals, profile and custom reminders with fresh UUIDs', async () => {
    const source = createStorageRepositories(memoryStorage());
    const target = createStorageRepositories(memoryStorage());
    const goals = { calories: 2259, proteinG: 160, carbsG: 263, fatG: 63 };

    const a = await source.meals.addMeal({ title: 'Eggs', calories: 200, proteinG: 14, carbsG: 2, fatG: 15, loggedAt: noon, photoUri: 'data:image/jpeg;base64,AAAA' });
    await source.meals.addMeal({ title: 'Toast', calories: 120, proteinG: 4, carbsG: 20, fatG: 2, loggedAt: noon + 1000 });
    await source.weights.addWeight({ kg: 80.5, loggedAt: noon });
    await source.goals.setGoals(goals);
    await source.profile.completeOnboarding(profile);
    await source.reminders.setReminders([{ id: 'x', name: 'Snack', hour: 15, minute: 0, enabled: true }]);

    expect(await importLocalData(source, target)).toEqual({ meals: 2, weights: 1, settings: true });

    const meals = await target.meals.listMealsForDay('2026-11-23');
    expect(meals.map((m) => m.title)).toEqual(['Eggs', 'Toast']);
    expect(meals[0].photoUri).toBe('data:image/jpeg;base64,AAAA');
    expect(meals[0].id).not.toBe(a.id);
    expect(isUuid(meals[0].id)).toBe(true);
    expect((await target.weights.listWeights())[0].kg).toBe(80.5);
    expect(await target.goals.getGoals()).toEqual(goals);
    expect(await target.profile.getProfile()).toEqual(profile);
    const reminders = await target.reminders.getReminders();
    expect(reminders).toHaveLength(1);
    expect(isUuid(reminders[0].id)).toBe(true);
  });

  it('leaves the source untouched and skips untouched defaults', async () => {
    const source = createStorageRepositories(memoryStorage());
    const target = createStorageRepositories(memoryStorage());
    await source.meals.addMeal({ title: 'Eggs', calories: 200, proteinG: 14, carbsG: 2, fatG: 15, loggedAt: noon });

    expect(await importLocalData(source, target)).toEqual({ meals: 1, weights: 0, settings: false });
    expect(await source.meals.listMealsForDay('2026-11-23')).toHaveLength(1);
    expect(await target.profile.isOnboarded()).toBe(false);
  });
});

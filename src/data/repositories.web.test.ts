import { createStorageRepositories, type KeyValueStorage } from './repositories.web';
import { DEFAULT_GOALS } from './types';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const base = { title: 'Eggs', calories: 200, proteinG: 14, carbsG: 2, fatG: 15 };
const noon = new Date(2026, 10, 23, 12, 0).getTime();

describe('web repositories', () => {
  it('adds, lists by day, and deletes meals', async () => {
    const { meals } = createStorageRepositories(memoryStorage());
    const a = await meals.addMeal({ ...base, loggedAt: noon });
    await meals.addMeal({ ...base, title: 'Toast', loggedAt: noon + 1000 });
    await meals.addMeal({ ...base, title: 'Yesterday', loggedAt: new Date(2026, 10, 22, 12).getTime() });

    expect(a.day).toBe('2026-11-23');
    const today = await meals.listMealsForDay('2026-11-23');
    expect(today.map((m) => m.title)).toEqual(['Eggs', 'Toast']);

    await meals.deleteMeal(a.id);
    expect((await meals.listMealsForDay('2026-11-23')).map((m) => m.title)).toEqual(['Toast']);
  });

  it('persists across repository instances sharing storage', async () => {
    const storage = memoryStorage();
    await createStorageRepositories(storage).meals.addMeal({ ...base, loggedAt: noon });
    const again = await createStorageRepositories(storage).meals.listMealsForDay('2026-11-23');
    expect(again).toHaveLength(1);
  });

  it('returns empty lists and default goals when stored JSON is corrupted', async () => {
    const storage = memoryStorage({
      'caltracker.meals.v1': '{not json',
      'caltracker.goals.v1': '[1,2',
    });
    const { meals, goals } = createStorageRepositories(storage);
    expect(await meals.listMealsForDay('2026-11-23')).toEqual([]);
    expect(await goals.getGoals()).toEqual(DEFAULT_GOALS);
  });

  it('does not crash when storage throws, and keeps data in memory', async () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const { meals } = createStorageRepositories(broken);
    await meals.addMeal({ ...base, loggedAt: noon });
    expect(await meals.listMealsForDay('2026-11-23')).toHaveLength(1);
  });

  it('drops blob: URLs but keeps data-URI thumbnails', async () => {
    const { meals } = createStorageRepositories(memoryStorage());
    const blob = await meals.addMeal({ ...base, loggedAt: noon, photoUri: 'blob:http://x/1' });
    expect(blob.photoUri).toBeUndefined();
    const thumb = await meals.addMeal({ ...base, loggedAt: noon, photoUri: 'data:image/jpeg;base64,AAAA' });
    expect(thumb.photoUri).toBe('data:image/jpeg;base64,AAAA');
  });

  it('updates the editable fields in place and returns null for unknown ids', async () => {
    const { meals } = createStorageRepositories(memoryStorage());
    const added = await meals.addMeal({ ...base, loggedAt: noon, photoUri: 'data:image/jpeg;base64,AAAA' });
    const updated = await meals.updateMeal(added.id, {
      title: 'Big eggs',
      calories: 300,
      proteinG: 20,
      carbsG: 3,
      fatG: 22,
    });
    expect(updated).toMatchObject({ id: added.id, title: 'Big eggs', calories: 300, day: '2026-11-23' });
    expect(updated?.photoUri).toBe('data:image/jpeg;base64,AAAA');
    expect((await meals.getMeal(added.id))?.title).toBe('Big eggs');
    expect(await meals.updateMeal('nope', { title: 'x', calories: 1, proteinG: 1, carbsG: 1, fatG: 1 })).toBeNull();
    expect(await meals.getMeal('nope')).toBeNull();
  });

  it('lists meals across an inclusive day range, oldest first', async () => {
    const { meals } = createStorageRepositories(memoryStorage());
    await meals.addMeal({ ...base, title: 'C', loggedAt: new Date(2026, 10, 25, 9).getTime() });
    await meals.addMeal({ ...base, title: 'A', loggedAt: new Date(2026, 10, 1, 9).getTime() });
    await meals.addMeal({ ...base, title: 'B', loggedAt: new Date(2026, 10, 30, 23, 30).getTime() });
    await meals.addMeal({ ...base, title: 'Out', loggedAt: new Date(2026, 11, 1, 0, 10).getTime() });
    const range = await meals.listMealsForRange('2026-11-01', '2026-11-30');
    expect(range.map((m) => m.title)).toEqual(['A', 'C', 'B']);
  });

  it('seeds default reminders, then keeps a custom list even when empty', async () => {
    const storage = memoryStorage();
    const { reminders } = createStorageRepositories(storage);
    const seeded = await reminders.getReminders();
    expect(seeded.map((r) => r.name)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(seeded.every((r) => !r.enabled)).toBe(true);

    await reminders.setReminders([{ id: 'a', name: 'Snack', hour: 15, minute: 45, enabled: true }]);
    expect((await createStorageRepositories(storage).reminders.getReminders())[0]).toMatchObject({
      name: 'Snack',
      hour: 15,
      minute: 45,
    });

    await reminders.setReminders([]);
    expect(await createStorageRepositories(storage).reminders.getReminders()).toEqual([]);
  });

  it('adds, edits, lists and deletes weight entries', async () => {
    const { weights } = createStorageRepositories(memoryStorage());
    const a = await weights.addWeight({ kg: 81.2, loggedAt: noon });
    await weights.addWeight({ kg: 80.8, loggedAt: new Date(2026, 10, 24, 8).getTime() });
    await weights.addWeight({ kg: 82, loggedAt: new Date(2026, 10, 20, 8).getTime() });

    expect(a.day).toBe('2026-11-23');
    expect((await weights.listWeights()).map((w) => w.kg)).toEqual([82, 81.2, 80.8]);
    expect((await weights.listWeightsForDay('2026-11-23')).map((w) => w.kg)).toEqual([81.2]);

    expect((await weights.updateWeight(a.id, 81.0))?.kg).toBe(81);
    expect((await weights.getWeight(a.id))?.kg).toBe(81);
    expect(await weights.updateWeight('nope', 70)).toBeNull();

    await weights.deleteWeight(a.id);
    expect(await weights.getWeight(a.id)).toBeNull();
  });

  it('ignores corrupted weight entries and bad kg values', async () => {
    const storage = memoryStorage({
      'caltracker.weights.v1': JSON.stringify([
        { id: 'ok', day: '2026-11-01', loggedAt: 1, kg: 80 },
        { id: 'bad', day: '2026-11-02', loggedAt: 2, kg: -3 },
        { nope: true },
      ]),
    });
    const list = await createStorageRepositories(storage).weights.listWeights();
    expect(list.map((w) => w.id)).toEqual(['ok']);
    expect(
      await createStorageRepositories(memoryStorage({ 'caltracker.weights.v1': '{bad' })).weights.listWeights(),
    ).toEqual([]);
  });

  it('tracks onboarding: pending by default, done after finishing or skipping', async () => {
    const storage = memoryStorage();
    const { profile } = createStorageRepositories(storage);
    expect(await profile.isOnboarded()).toBe(false);
    expect(await profile.getProfile()).toBeNull();

    const me = { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' } as const;
    await profile.completeOnboarding(me);
    const again = createStorageRepositories(storage).profile;
    expect(await again.isOnboarded()).toBe(true);
    expect(await again.getProfile()).toEqual(me);

    const skipped = createStorageRepositories(memoryStorage()).profile;
    await skipped.completeOnboarding(null);
    expect(await skipped.isOnboarded()).toBe(true);
    expect(await skipped.getProfile()).toBeNull();
  });

  it('treats a corrupted profile record as not onboarded', async () => {
    const storage = memoryStorage({ 'caltracker.profile.v1': '{bad' });
    expect(await createStorageRepositories(storage).profile.isOnboarded()).toBe(false);
  });

  it('falls back to default reminders when stored JSON is corrupted', async () => {
    const storage = memoryStorage({ 'caltracker.reminders.v1': '{oops' });
    const list = await createStorageRepositories(storage).reminders.getReminders();
    expect(list).toHaveLength(3);
  });

  it('stores and returns goals, falling back to defaults', async () => {
    const { goals } = createStorageRepositories(memoryStorage());
    expect(await goals.getGoals()).toEqual(DEFAULT_GOALS);
    await goals.setGoals({ calories: 1800, proteinG: 140, carbsG: 150, fatG: 60 });
    expect(await goals.getGoals()).toEqual({ calories: 1800, proteinG: 140, carbsG: 150, fatG: 60 });
  });
});

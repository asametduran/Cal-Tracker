import type { KeyValueStorage } from './repositories.web';
import { createSyncEngine, type RemoteApi, type Snapshot } from './sync';
import type { Goals, Meal, Reminder, WeightEntry } from './types';
import type { ProfileState } from './validation';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function fakeRemote() {
  const state = {
    online: true,
    calls: [] as string[],
    meals: [] as Meal[],
    weights: [] as WeightEntry[],
    reminders: [] as Reminder[],
    profile: { onboarded: false, profile: null } as ProfileState,
    goals: null as Goals | null,
    pullGate: null as Promise<void> | null,
  };
  const guard = (call: string) => {
    if (!state.online) throw new Error('offline');
    state.calls.push(call);
  };
  const api: RemoteApi = {
    async pull(): Promise<Snapshot> {
      guard('pull');
      if (state.pullGate) await state.pullGate;
      return { meals: [...state.meals], weights: [...state.weights], reminders: [...state.reminders], profile: state.profile, goals: state.goals };
    },
    async upsertMeal(m) {
      guard('upsertMeal');
      state.meals = [...state.meals.filter((x) => x.id !== m.id), m];
    },
    async deleteMeal(id) {
      guard('deleteMeal');
      state.meals = state.meals.filter((x) => x.id !== id);
    },
    async upsertWeight(w) {
      guard('upsertWeight');
      state.weights = [...state.weights.filter((x) => x.id !== w.id), w];
    },
    async deleteWeight(id) {
      guard('deleteWeight');
      state.weights = state.weights.filter((x) => x.id !== id);
    },
    async saveProfile(p, g) {
      guard('saveProfile');
      state.profile = p;
      state.goals = g;
    },
    async saveReminders(r) {
      guard('saveReminders');
      state.reminders = r;
    },
  };
  return { api, state };
}

const base = { title: 'Eggs', calories: 200, proteinG: 14, carbsG: 2, fatG: 15 };
const noon = new Date(2026, 10, 23, 12).getTime();

describe('sync engine: writes', () => {
  it('applies writes locally at once and pushes them to the server', async () => {
    const { api, state } = fakeRemote();
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    const meal = await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });

    expect((await engine.repositories.meals.listMealsForDay('2026-11-23')).map((m) => m.id)).toEqual([meal.id]);
    expect(await engine.flush()).toBe(true);
    expect(state.meals.map((m) => m.id)).toEqual([meal.id]);
    expect(engine.pendingCount()).toBe(0);
  });

  it('keeps changes queued while offline and sends them once back online', async () => {
    const { api, state } = fakeRemote();
    state.online = false;
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });
    await engine.repositories.weights.addWeight({ kg: 80, loggedAt: noon });

    expect(await engine.flush()).toBe(false);
    expect(engine.pendingCount()).toBe(2);
    expect((await engine.sync()).status).toBe('failed');

    state.online = true;
    expect(await engine.flush()).toBe(true);
    expect(engine.pendingCount()).toBe(0);
    expect(state.meals).toHaveLength(1);
    expect(state.weights).toHaveLength(1);
  });

  it('coalesces repeated edits into one upsert with the latest values', async () => {
    const { api, state } = fakeRemote();
    state.online = false;
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    const meal = await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });
    await engine.repositories.meals.updateMeal(meal.id, { title: 'Eggs 2', calories: 250, proteinG: 1, carbsG: 1, fatG: 1 });
    await engine.repositories.meals.updateMeal(meal.id, { title: 'Eggs 3', calories: 300, proteinG: 1, carbsG: 1, fatG: 1 });
    expect(await engine.flush()).toBe(false);

    state.online = true;
    await engine.flush();
    expect(state.calls.filter((c) => c === 'upsertMeal')).toHaveLength(1);
    expect(state.meals[0].title).toBe('Eggs 3');
  });

  it('never sends a meal that was deleted before it synced', async () => {
    const { api, state } = fakeRemote();
    state.online = false;
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    const meal = await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });
    await engine.repositories.meals.deleteMeal(meal.id);
    expect(await engine.flush()).toBe(false);

    state.online = true;
    await engine.flush();
    expect(state.calls).not.toContain('upsertMeal');
    expect(state.meals).toEqual([]);
  });

  it('survives an app restart: the queue is persisted with the cache', async () => {
    const { api, state } = fakeRemote();
    state.online = false;
    const storage = memoryStorage();
    const first = createSyncEngine({ storage, remote: api });
    const meal = await first.repositories.meals.addMeal({ ...base, loggedAt: noon });

    state.online = true;
    const second = createSyncEngine({ storage, remote: api });
    expect(second.pendingCount()).toBe(1);
    await second.flush();
    expect(state.meals.map((m) => m.id)).toEqual([meal.id]);
  });

  it('pushes profile, goals and reminders using the current local state', async () => {
    const { api, state } = fakeRemote();
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    const goals = { calories: 2259, proteinG: 160, carbsG: 263, fatG: 63 };
    const profile = { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' } as const;
    await engine.repositories.goals.setGoals(goals);
    await engine.repositories.profile.completeOnboarding(profile);
    await engine.repositories.reminders.setReminders([{ id: 'r1', name: 'Snack', hour: 15, minute: 0, enabled: true }]);
    await engine.flush();

    expect(state.goals).toEqual(goals);
    expect(state.profile).toEqual({ onboarded: true, profile });
    expect(state.reminders.map((r) => r.name)).toEqual(['Snack']);
  });
});

describe('sync engine: pull', () => {
  it('replaces the cache with the server copy and marks the device hydrated', async () => {
    const { api, state } = fakeRemote();
    const remoteMeal: Meal = { ...base, id: 'srv-1', day: '2026-11-22', loggedAt: new Date(2026, 10, 22, 9).getTime() };
    state.meals = [remoteMeal];
    state.profile = { onboarded: true, profile: null };
    state.goals = { calories: 1800, proteinG: 120, carbsG: 150, fatG: 60 };
    state.reminders = [{ id: 'r1', name: 'Lunch', hour: 12, minute: 30, enabled: true }];

    const onChange = jest.fn();
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api, onChange });
    expect(engine.isHydrated()).toBe(false);

    expect(await engine.sync()).toEqual({ status: 'ok', remoteWasEmpty: false });
    expect(engine.isHydrated()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((await engine.repositories.meals.listMealsForDay('2026-11-22')).map((m) => m.id)).toEqual(['srv-1']);
    expect(await engine.repositories.goals.getGoals()).toEqual(state.goals);
    expect(await engine.repositories.profile.isOnboarded()).toBe(true);
    expect((await engine.repositories.reminders.getReminders())[0].name).toBe('Lunch');
  });

  it('reports when the account is brand new', async () => {
    const { api } = fakeRemote();
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    expect(await engine.sync()).toEqual({ status: 'ok', remoteWasEmpty: true });
  });

  it('removes things deleted on another device', async () => {
    const { api, state } = fakeRemote();
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });
    const meal = await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });
    await engine.flush();
    state.meals = [];
    await engine.sync();
    expect(await engine.repositories.meals.getMeal(meal.id)).toBeNull();
  });

  it('discards a pull when the user changed something meanwhile, keeping their edit', async () => {
    const { api, state } = fakeRemote();
    let release!: () => void;
    state.pullGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = createSyncEngine({ storage: memoryStorage(), remote: api });

    const pending = engine.sync();
    await new Promise((r) => setTimeout(r, 0));
    const meal = await engine.repositories.meals.addMeal({ ...base, loggedAt: noon });
    release();

    expect((await pending).status).toBe('stale');
    expect(await engine.repositories.meals.getMeal(meal.id)).not.toBeNull();
    expect(engine.isHydrated()).toBe(false);
  });
});

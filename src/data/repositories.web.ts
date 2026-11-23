import { dayKey } from './day';
import type {
  Goals,
  Meal,
  MealChanges,
  NewMeal,
  NewWeight,
  Profile,
  Reminder,
  Repositories,
  WeightEntry,
} from './types';
import { isMeal, isWeightEntry, newId, parseGoals, parseProfileState, parseReminders, type ProfileState } from './validation';

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const MEALS_KEY = 'caltracker.meals.v1';
const GOALS_KEY = 'caltracker.goals.v1';
const REMINDERS_KEY = 'caltracker.reminders.v1';
const WEIGHTS_KEY = 'caltracker.weights.v1';
const PROFILE_KEY = 'caltracker.profile.v1';

/** Storage keys, exported so the sync engine can write a server snapshot into the cache. */
export const STORAGE_KEYS = {
  meals: MEALS_KEY,
  goals: GOALS_KEY,
  reminders: REMINDERS_KEY,
  weights: WEIGHTS_KEY,
  profile: PROFILE_KEY,
} as const;

/** Object/blob URLs die on reload, so they are not worth persisting. */
function persistablePhotoUri(uri: string | undefined): string | undefined {
  if (!uri || uri.startsWith('blob:')) return undefined;
  return uri;
}

/**
 * Repositories backed by a localStorage-like store. Reads never throw: corrupted
 * or unavailable storage yields empty data, and writes that fail stay in memory
 * for the session.
 */
export function createStorageRepositories(storage: KeyValueStorage): Repositories {
  let mealsCache: Meal[] | null = null;
  let goalsCache: Goals | null = null;
  let remindersCache: Reminder[] | null = null;
  let weightsCache: WeightEntry[] | null = null;
  let profileCache: ProfileState | null = null;

  function loadMeals(): Meal[] {
    if (mealsCache) return mealsCache;
    let list: Meal[] = [];
    try {
      const raw = storage.getItem(MEALS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed.filter(isMeal);
    } catch {
      list = [];
    }
    mealsCache = list;
    return list;
  }

  function saveMeals(list: Meal[]): void {
    mealsCache = list;
    try {
      storage.setItem(MEALS_KEY, JSON.stringify(list));
    } catch {
      // Storage unavailable or full: keep the in-memory copy.
    }
  }

  function loadWeights(): WeightEntry[] {
    if (weightsCache) return weightsCache;
    let list: WeightEntry[] = [];
    try {
      const raw = storage.getItem(WEIGHTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed.filter(isWeightEntry);
    } catch {
      list = [];
    }
    weightsCache = list;
    return list;
  }

  function saveWeights(list: WeightEntry[]): void {
    weightsCache = list;
    try {
      storage.setItem(WEIGHTS_KEY, JSON.stringify(list));
    } catch {
      // Storage unavailable or full: keep the in-memory copy.
    }
  }

  function loadProfileState(): ProfileState {
    if (profileCache) return profileCache;
    let raw: string | null = null;
    try {
      raw = storage.getItem(PROFILE_KEY);
    } catch {
      raw = null;
    }
    profileCache = parseProfileState(raw);
    return profileCache;
  }

  return {
    meals: {
      async addMeal(input: NewMeal): Promise<Meal> {
        const meal: Meal = {
          ...input,
          id: newId(),
          day: dayKey(new Date(input.loggedAt)),
          photoUri: persistablePhotoUri(input.photoUri),
        };
        saveMeals([...loadMeals(), meal]);
        return meal;
      },
      async listMealsForDay(day: string): Promise<Meal[]> {
        return loadMeals()
          .filter((m) => m.day === day)
          .sort((a, b) => a.loggedAt - b.loggedAt);
      },
      async deleteMeal(id: string): Promise<void> {
        saveMeals(loadMeals().filter((m) => m.id !== id));
      },
      async getMeal(id: string): Promise<Meal | null> {
        return loadMeals().find((m) => m.id === id) ?? null;
      },
      async updateMeal(id: string, changes: MealChanges): Promise<Meal | null> {
        const list = loadMeals();
        const existing = list.find((m) => m.id === id);
        if (!existing) return null;
        const updated: Meal = { ...existing, ...changes };
        saveMeals(list.map((m) => (m.id === id ? updated : m)));
        return updated;
      },
      async listMealsForRange(fromDay: string, toDay: string): Promise<Meal[]> {
        return loadMeals()
          .filter((m) => m.day >= fromDay && m.day <= toDay)
          .sort((a, b) => a.loggedAt - b.loggedAt);
      },
    },
    goals: {
      async getGoals(): Promise<Goals> {
        if (goalsCache) return { ...goalsCache };
        let raw: string | null = null;
        try {
          raw = storage.getItem(GOALS_KEY);
        } catch {
          raw = null;
        }
        goalsCache = parseGoals(raw);
        return { ...goalsCache };
      },
      async setGoals(goals: Goals): Promise<void> {
        goalsCache = { ...goals };
        try {
          storage.setItem(GOALS_KEY, JSON.stringify(goalsCache));
        } catch {
          // Keep the in-memory copy.
        }
      },
    },
    reminders: {
      async getReminders(): Promise<Reminder[]> {
        if (!remindersCache) {
          let raw: string | null = null;
          try {
            raw = storage.getItem(REMINDERS_KEY);
          } catch {
            raw = null;
          }
          remindersCache = parseReminders(raw);
        }
        return remindersCache.map((r) => ({ ...r }));
      },
      async setReminders(reminders: Reminder[]): Promise<void> {
        remindersCache = reminders.map((r) => ({ ...r }));
        try {
          storage.setItem(REMINDERS_KEY, JSON.stringify(remindersCache));
        } catch {
          // Keep the in-memory copy.
        }
      },
    },
    profile: {
      async getProfile(): Promise<Profile | null> {
        return loadProfileState().profile;
      },
      async isOnboarded(): Promise<boolean> {
        return loadProfileState().onboarded;
      },
      async completeOnboarding(profile: Profile | null): Promise<void> {
        profileCache = { onboarded: true, profile };
        try {
          storage.setItem(PROFILE_KEY, JSON.stringify(profileCache));
        } catch {
          // Keep the in-memory copy.
        }
      },
    },
    weights: {
      async addWeight(input: NewWeight): Promise<WeightEntry> {
        const entry: WeightEntry = { ...input, id: newId(), day: dayKey(new Date(input.loggedAt)) };
        saveWeights([...loadWeights(), entry]);
        return entry;
      },
      async getWeight(id: string): Promise<WeightEntry | null> {
        return loadWeights().find((w) => w.id === id) ?? null;
      },
      async updateWeight(id: string, kg: number): Promise<WeightEntry | null> {
        const list = loadWeights();
        const existing = list.find((w) => w.id === id);
        if (!existing) return null;
        const updated: WeightEntry = { ...existing, kg };
        saveWeights(list.map((w) => (w.id === id ? updated : w)));
        return updated;
      },
      async deleteWeight(id: string): Promise<void> {
        saveWeights(loadWeights().filter((w) => w.id !== id));
      },
      async listWeightsForDay(day: string): Promise<WeightEntry[]> {
        return loadWeights()
          .filter((w) => w.day === day)
          .sort((a, b) => a.loggedAt - b.loggedAt);
      },
      async listWeights(): Promise<WeightEntry[]> {
        return [...loadWeights()].sort((a, b) => a.loggedAt - b.loggedAt);
      },
    },
  };
}

function browserStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    if (ls) return ls;
  } catch {
    // Access itself can throw in locked-down browsers.
  }
  const memory = new Map<string, string>();
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
  };
}

export const repositories: Repositories = createStorageRepositories(browserStorage());

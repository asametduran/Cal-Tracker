import { createStorageRepositories, STORAGE_KEYS, type KeyValueStorage } from './repositories.web';
import type { Goals, Meal, Reminder, Repositories, WeightEntry } from './types';
import type { ProfileState } from './validation';

/** Everything the server holds for the signed-in user. */
export type Snapshot = {
  meals: Meal[];
  weights: WeightEntry[];
  reminders: Reminder[];
  profile: ProfileState;
  /** null when the profile row has no targets yet. */
  goals: Goals | null;
};

export interface RemoteApi {
  pull(): Promise<Snapshot>;
  upsertMeal(meal: Meal): Promise<void>;
  deleteMeal(id: string): Promise<void>;
  upsertWeight(entry: WeightEntry): Promise<void>;
  deleteWeight(id: string): Promise<void>;
  saveProfile(state: ProfileState, goals: Goals): Promise<void>;
  saveReminders(reminders: Reminder[]): Promise<void>;
}

type OutboxOp =
  | { kind: 'meal' | 'weight'; id: string; action: 'upsert' | 'delete' }
  | { kind: 'profile' }
  | { kind: 'reminders' };

const OUTBOX_KEY = 'caltracker.outbox.v1';
const HYDRATED_KEY = 'caltracker.hydrated.v1';

const opKey = (op: OutboxOp) => ('id' in op ? `${op.kind}:${op.id}` : op.kind);

export type SyncResult =
  | { status: 'ok'; remoteWasEmpty: boolean }
  /** Could not reach the server; queued changes are kept for the next attempt. */
  | { status: 'failed' }
  /** Local data changed while pulling, so the pulled copy was discarded. Safe to try again. */
  | { status: 'stale' };

export type SyncEngine = {
  /** Reads from the local cache; writes apply locally at once and are queued for the server. */
  repositories: Repositories;
  /** Push queued changes, then refresh the cache from the server. */
  sync(): Promise<SyncResult>;
  /** Push queued changes only. Resolves true when the queue is empty. */
  flush(): Promise<boolean>;
  pendingCount(): number;
  /** True once this device has completed one full pull for this account. */
  isHydrated(): boolean;
};

type Options = {
  /** Per-user cache. Must already be loaded (see createPersistentStorage().ready). */
  storage: KeyValueStorage;
  remote: RemoteApi;
  /** Called after a pull replaced the cache, so screens can reload. */
  onChange?: () => void;
};

/**
 * Local-first sync. Reads always come from the on-device cache, so the UI is instant and never
 * waits on the network. Writes land in the cache immediately and are queued; the queue is pushed to
 * the server in order and retried until it succeeds. Conflict policy is last write wins: a pull only
 * replaces the cache when nothing local is waiting to be pushed.
 */
export function createSyncEngine({ storage, remote, onChange }: Options): SyncEngine {
  let local = createStorageRepositories(storage);
  let version = 0;
  let flushing: Promise<boolean> | null = null;
  let syncing: Promise<SyncResult> | null = null;

  const outbox = new Map<string, OutboxOp>();
  try {
    const raw = storage.getItem(OUTBOX_KEY);
    const stored: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(stored)) {
      for (const op of stored as OutboxOp[]) {
        if (op && typeof op === 'object' && 'kind' in op) outbox.set(opKey(op), op);
      }
    }
  } catch {
    // Corrupted queue: start empty; the next pull restores the server's copy.
  }

  function persistOutbox(): void {
    try {
      storage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()]));
    } catch {
      // Keep the in-memory queue.
    }
  }

  function enqueue(op: OutboxOp): void {
    version++;
    outbox.set(opKey(op), op);
    persistOutbox();
    void flush();
  }

  async function runOp(op: OutboxOp): Promise<void> {
    switch (op.kind) {
      case 'meal': {
        if (op.action === 'delete') return remote.deleteMeal(op.id);
        const meal = await local.meals.getMeal(op.id);
        if (meal) await remote.upsertMeal(meal);
        return;
      }
      case 'weight': {
        if (op.action === 'delete') return remote.deleteWeight(op.id);
        const entry = await local.weights.getWeight(op.id);
        if (entry) await remote.upsertWeight(entry);
        return;
      }
      case 'profile':
        return remote.saveProfile(
          { onboarded: await local.profile.isOnboarded(), profile: await local.profile.getProfile() },
          await local.goals.getGoals(),
        );
      case 'reminders':
        return remote.saveReminders(await local.reminders.getReminders());
    }
  }

  function flush(): Promise<boolean> {
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        // Loop until the queue is empty: changes made while a push is in flight are sent too.
        while (outbox.size > 0) {
          for (const op of [...outbox.values()]) {
            try {
              await runOp(op);
            } catch {
              return false;
            }
            // Only drop it if it wasn't replaced by a newer change while it was in flight.
            if (outbox.get(opKey(op)) === op) {
              outbox.delete(opKey(op));
              persistOutbox();
            }
          }
        }
        return true;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  function applySnapshot(snapshot: Snapshot): void {
    storage.setItem(STORAGE_KEYS.meals, JSON.stringify(snapshot.meals));
    storage.setItem(STORAGE_KEYS.weights, JSON.stringify(snapshot.weights));
    storage.setItem(STORAGE_KEYS.reminders, JSON.stringify(snapshot.reminders));
    storage.setItem(STORAGE_KEYS.profile, JSON.stringify(snapshot.profile));
    storage.setItem(STORAGE_KEYS.goals, JSON.stringify(snapshot.goals));
    storage.setItem(HYDRATED_KEY, '1');
    local = createStorageRepositories(storage);
  }

  function sync(): Promise<SyncResult> {
    if (syncing) return syncing;
    syncing = (async (): Promise<SyncResult> => {
      try {
        if (!(await flush())) return { status: 'failed' };
        const startVersion = version;
        const snapshot = await remote.pull();
        if (version !== startVersion || outbox.size > 0) return { status: 'stale' };
        const remoteWasEmpty =
          snapshot.meals.length === 0 && snapshot.weights.length === 0 && !snapshot.profile.onboarded;
        applySnapshot(snapshot);
        onChange?.();
        return { status: 'ok', remoteWasEmpty };
      } catch {
        return { status: 'failed' };
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }

  const repositories: Repositories = {
    meals: {
      async addMeal(input) {
        const meal = await local.meals.addMeal(input);
        enqueue({ kind: 'meal', id: meal.id, action: 'upsert' });
        return meal;
      },
      getMeal: (id) => local.meals.getMeal(id),
      async updateMeal(id, changes) {
        const meal = await local.meals.updateMeal(id, changes);
        if (meal) enqueue({ kind: 'meal', id, action: 'upsert' });
        return meal;
      },
      async deleteMeal(id) {
        await local.meals.deleteMeal(id);
        enqueue({ kind: 'meal', id, action: 'delete' });
      },
      listMealsForDay: (day) => local.meals.listMealsForDay(day),
      listMealsForRange: (from, to) => local.meals.listMealsForRange(from, to),
    },
    weights: {
      async addWeight(input) {
        const entry = await local.weights.addWeight(input);
        enqueue({ kind: 'weight', id: entry.id, action: 'upsert' });
        return entry;
      },
      getWeight: (id) => local.weights.getWeight(id),
      async updateWeight(id, kg) {
        const entry = await local.weights.updateWeight(id, kg);
        if (entry) enqueue({ kind: 'weight', id, action: 'upsert' });
        return entry;
      },
      async deleteWeight(id) {
        await local.weights.deleteWeight(id);
        enqueue({ kind: 'weight', id, action: 'delete' });
      },
      listWeightsForDay: (day) => local.weights.listWeightsForDay(day),
      listWeights: () => local.weights.listWeights(),
    },
    goals: {
      getGoals: () => local.goals.getGoals(),
      async setGoals(goals) {
        await local.goals.setGoals(goals);
        enqueue({ kind: 'profile' });
      },
    },
    profile: {
      getProfile: () => local.profile.getProfile(),
      isOnboarded: () => local.profile.isOnboarded(),
      async completeOnboarding(profile) {
        await local.profile.completeOnboarding(profile);
        enqueue({ kind: 'profile' });
      },
    },
    reminders: {
      getReminders: () => local.reminders.getReminders(),
      async setReminders(reminders) {
        await local.reminders.setReminders(reminders);
        enqueue({ kind: 'reminders' });
      },
    },
  };

  return {
    repositories,
    sync,
    flush,
    pendingCount: () => outbox.size,
    isHydrated: () => storage.getItem(HYDRATED_KEY) === '1',
  };
}

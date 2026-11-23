import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mealToRow,
  profileToRow,
  reminderToRow,
  rowToMeal,
  rowToProfile,
  rowToReminder,
  rowToWeight,
  weightToRow,
  type MealRow,
  type ProfileRow,
  type ReminderRow,
  type WeightRow,
} from './remoteMappers';
import type { RemoteApi, Snapshot } from './sync';
import { isUuid } from './validation';

const PAGE_SIZE = 1000;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

async function fetchAll<T>(client: SupabaseClient, table: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(orderBy, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/**
 * Supabase implementation of the sync engine's server API. Every call runs as the signed-in user,
 * so Row Level Security scopes it to their own rows; `user_id` is filled in by the database default.
 */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteApi {
  return {
    async pull(): Promise<Snapshot> {
      const [meals, weights, reminders, profile] = await Promise.all([
        fetchAll<MealRow>(client, 'meals', 'logged_at'),
        fetchAll<WeightRow>(client, 'weight_logs', 'logged_at'),
        fetchAll<ReminderRow>(client, 'meal_reminders', 'sort_order'),
        client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      ]);
      check(profile.error);
      const { state, goals } = rowToProfile((profile.data as ProfileRow | null) ?? null);
      return {
        meals: meals.map(rowToMeal),
        weights: weights.map(rowToWeight),
        reminders: reminders.map(rowToReminder),
        profile: state,
        goals,
      };
    },

    async upsertMeal(meal) {
      check((await client.from('meals').upsert(mealToRow(meal), { onConflict: 'id' })).error);
    },
    async deleteMeal(id) {
      check((await client.from('meals').delete().eq('id', id)).error);
    },
    async upsertWeight(entry) {
      check((await client.from('weight_logs').upsert(weightToRow(entry), { onConflict: 'id' })).error);
    },
    async deleteWeight(id) {
      check((await client.from('weight_logs').delete().eq('id', id)).error);
    },
    async saveProfile(state, goals) {
      check((await client.from('profiles').upsert(profileToRow(userId, state, goals), { onConflict: 'id' })).error);
    },

    async saveReminders(reminders) {
      // Ids must be UUIDs; skipping others keeps one bad entry from wedging the whole sync queue.
      const rows = reminders.filter((r) => isUuid(r.id)).map((r, i) => reminderToRow(r, i));
      if (rows.length > 0) {
        check((await client.from('meal_reminders').upsert(rows, { onConflict: 'id' })).error);
      }
      const remove = client.from('meal_reminders').delete();
      const { error } =
        rows.length > 0 ? await remove.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`) : await remove.neq('id', NIL_UUID);
      check(error);
    },
  };
}

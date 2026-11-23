import * as SQLite from 'expo-sqlite';

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
import { newId, parseGoals, parseProfileState, parseReminders } from './validation';

/** Native (iOS/Android) repositories on expo-sqlite. Web uses repositories.web.ts. */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openDb();
  return dbPromise;
}

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('caltracker.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      day TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      photo_uri TEXT
    );
    CREATE INDEX IF NOT EXISTS meals_day_idx ON meals (day, logged_at);
    CREATE TABLE IF NOT EXISTS weights (
      id TEXT PRIMARY KEY NOT NULL,
      day TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      kg REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS weights_day_idx ON weights (day, logged_at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return db;
}

type MealRow = {
  id: string;
  title: string;
  day: string;
  logged_at: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photo_uri: string | null;
};

function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    title: row.title,
    day: row.day,
    loggedAt: row.logged_at,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    photoUri: row.photo_uri ?? undefined,
  };
}

type WeightRow = { id: string; day: string; logged_at: number; kg: number };

function toWeight(row: WeightRow): WeightEntry {
  return { id: row.id, day: row.day, loggedAt: row.logged_at, kg: row.kg };
}

async function readWeight(id: string): Promise<WeightEntry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WeightRow>('SELECT * FROM weights WHERE id = ?', id);
  return row ? toWeight(row) : null;
}

async function readProfileState() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'profile'");
  return parseProfileState(row?.value);
}

export const repositories: Repositories = {
  meals: {
    async addMeal(input: NewMeal): Promise<Meal> {
      const db = await getDb();
      const meal: Meal = { ...input, id: newId(), day: dayKey(new Date(input.loggedAt)) };
      await db.runAsync(
        'INSERT INTO meals (id, title, day, logged_at, calories, protein_g, carbs_g, fat_g, photo_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        meal.id,
        meal.title,
        meal.day,
        meal.loggedAt,
        meal.calories,
        meal.proteinG,
        meal.carbsG,
        meal.fatG,
        meal.photoUri ?? null,
      );
      return meal;
    },
    async listMealsForDay(day: string): Promise<Meal[]> {
      const db = await getDb();
      const rows = await db.getAllAsync<MealRow>(
        'SELECT * FROM meals WHERE day = ? ORDER BY logged_at ASC',
        day,
      );
      return rows.map(toMeal);
    },
    async deleteMeal(id: string): Promise<void> {
      const db = await getDb();
      await db.runAsync('DELETE FROM meals WHERE id = ?', id);
    },
    async getMeal(id: string): Promise<Meal | null> {
      const db = await getDb();
      const row = await db.getFirstAsync<MealRow>('SELECT * FROM meals WHERE id = ?', id);
      return row ? toMeal(row) : null;
    },
    async updateMeal(id: string, changes: MealChanges): Promise<Meal | null> {
      const db = await getDb();
      await db.runAsync(
        'UPDATE meals SET title = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?',
        changes.title,
        changes.calories,
        changes.proteinG,
        changes.carbsG,
        changes.fatG,
        id,
      );
      const row = await db.getFirstAsync<MealRow>('SELECT * FROM meals WHERE id = ?', id);
      return row ? toMeal(row) : null;
    },
    async listMealsForRange(fromDay: string, toDay: string): Promise<Meal[]> {
      const db = await getDb();
      const rows = await db.getAllAsync<MealRow>(
        'SELECT * FROM meals WHERE day >= ? AND day <= ? ORDER BY logged_at ASC',
        fromDay,
        toDay,
      );
      return rows.map(toMeal);
    },
  },
  goals: {
    async getGoals(): Promise<Goals> {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'goals'");
      return parseGoals(row?.value);
    },
    async setGoals(goals: Goals): Promise<void> {
      const db = await getDb();
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES ('goals', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        JSON.stringify(goals),
      );
    },
  },
  reminders: {
    async getReminders(): Promise<Reminder[]> {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'reminders'");
      return parseReminders(row?.value);
    },
    async setReminders(reminders: Reminder[]): Promise<void> {
      const db = await getDb();
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES ('reminders', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        JSON.stringify(reminders),
      );
    },
  },
  profile: {
    async getProfile(): Promise<Profile | null> {
      return (await readProfileState()).profile;
    },
    async isOnboarded(): Promise<boolean> {
      return (await readProfileState()).onboarded;
    },
    async completeOnboarding(profile: Profile | null): Promise<void> {
      const db = await getDb();
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES ('profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        JSON.stringify({ onboarded: true, profile }),
      );
    },
  },
  weights: {
    async addWeight(input: NewWeight): Promise<WeightEntry> {
      const db = await getDb();
      const entry: WeightEntry = { ...input, id: newId(), day: dayKey(new Date(input.loggedAt)) };
      await db.runAsync(
        'INSERT INTO weights (id, day, logged_at, kg) VALUES (?, ?, ?, ?)',
        entry.id,
        entry.day,
        entry.loggedAt,
        entry.kg,
      );
      return entry;
    },
    getWeight: readWeight,
    async updateWeight(id: string, kg: number): Promise<WeightEntry | null> {
      const db = await getDb();
      await db.runAsync('UPDATE weights SET kg = ? WHERE id = ?', kg, id);
      return readWeight(id);
    },
    async deleteWeight(id: string): Promise<void> {
      const db = await getDb();
      await db.runAsync('DELETE FROM weights WHERE id = ?', id);
    },
    async listWeightsForDay(day: string): Promise<WeightEntry[]> {
      const db = await getDb();
      const rows = await db.getAllAsync<WeightRow>(
        'SELECT * FROM weights WHERE day = ? ORDER BY logged_at ASC',
        day,
      );
      return rows.map(toWeight);
    },
    async listWeights(): Promise<WeightEntry[]> {
      const db = await getDb();
      const rows = await db.getAllAsync<WeightRow>('SELECT * FROM weights ORDER BY logged_at ASC');
      return rows.map(toWeight);
    },
  },
};

export type Macros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type Goals = Macros;
export type Totals = Macros;

export type Goal = 'lose' | 'maintain' | 'gain' | 'muscle';
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** Metric units: centimetres and kilograms. */
export type Profile = {
  goal: Goal;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
};

export type WeightEntry = {
  id: string;
  /** Local-time day, `YYYY-MM-DD`. */
  day: string;
  /** Epoch milliseconds. */
  loggedAt: number;
  kg: number;
};

export type NewWeight = Omit<WeightEntry, 'id' | 'day'>;

export const DEFAULT_GOALS: Goals = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };

export type Meal = Macros & {
  id: string;
  title: string;
  /** Local-time day the meal belongs to, `YYYY-MM-DD`. */
  day: string;
  /** Epoch milliseconds. */
  loggedAt: number;
  /** Small compressed JPEG thumbnail as a data URI (not the original photo). */
  photoUri?: string;
};

export type NewMeal = Omit<Meal, 'id' | 'day'>;

export interface MealRepository {
  addMeal(meal: NewMeal): Promise<Meal>;
  listMealsForDay(day: string): Promise<Meal[]>;
  deleteMeal(id: string): Promise<void>;
  getMeal(id: string): Promise<Meal | null>;
  /** Replaces the editable fields. Resolves to null when the meal no longer exists. */
  updateMeal(id: string, changes: MealChanges): Promise<Meal | null>;
  /** Inclusive range of `YYYY-MM-DD` days, oldest first. */
  listMealsForRange(fromDay: string, toDay: string): Promise<Meal[]>;
}

export interface GoalsRepository {
  getGoals(): Promise<Goals>;
  setGoals(goals: Goals): Promise<void>;
}

export type MealChanges = Macros & { title: string };

export type Reminder = {
  id: string;
  name: string;
  /** 0-23, local time. */
  hour: number;
  /** 0-59. */
  minute: number;
  enabled: boolean;
};

export const DEFAULT_REMINDERS: readonly Reminder[] = [
  { id: 'breakfast', name: 'Breakfast', hour: 8, minute: 0, enabled: false },
  { id: 'lunch', name: 'Lunch', hour: 12, minute: 30, enabled: false },
  { id: 'dinner', name: 'Dinner', hour: 18, minute: 30, enabled: false },
];

export interface ReminderRepository {
  /** Seeded with DEFAULT_REMINDERS until the user saves their own list (which may be empty). */
  getReminders(): Promise<Reminder[]>;
  setReminders(reminders: Reminder[]): Promise<void>;
}

export interface ProfileRepository {
  getProfile(): Promise<Profile | null>;
  /** True once the user finished or skipped onboarding. */
  isOnboarded(): Promise<boolean>;
  /** Pass null when the user skipped; calling it again with a profile records a recalculation. */
  completeOnboarding(profile: Profile | null): Promise<void>;
}

export interface WeightRepository {
  addWeight(entry: NewWeight): Promise<WeightEntry>;
  getWeight(id: string): Promise<WeightEntry | null>;
  updateWeight(id: string, kg: number): Promise<WeightEntry | null>;
  deleteWeight(id: string): Promise<void>;
  listWeightsForDay(day: string): Promise<WeightEntry[]>;
  /** Every entry, oldest first. */
  listWeights(): Promise<WeightEntry[]>;
}

export type Repositories = {
  meals: MealRepository;
  goals: GoalsRepository;
  reminders: ReminderRepository;
  profile: ProfileRepository;
  weights: WeightRepository;
};

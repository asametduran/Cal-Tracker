import {
  DEFAULT_GOALS,
  DEFAULT_REMINDERS,
  type Goals,
  type Meal,
  type Profile,
  type Reminder,
  type WeightEntry,
} from './types';

/** Random UUID v4, so ids created on-device are valid primary keys in Postgres too. */
export function newId(): string {
  const bytes = new Uint8Array(16);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10).join('')}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isGoals(value: unknown): value is Goals {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isNonNegative(v.calories) && isNonNegative(v.proteinG) && isNonNegative(v.carbsG) && isNonNegative(v.fatG)
  );
}

export function isMeal(value: unknown): value is Meal {
  if (!isGoals(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.day === 'string' &&
    typeof v.loggedAt === 'number' &&
    Number.isFinite(v.loggedAt)
  );
}

const GOAL_VALUES = ['lose', 'maintain', 'gain', 'muscle'];
const SEX_VALUES = ['male', 'female'];
const ACTIVITY_VALUES = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

export function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.goal === 'string' &&
    GOAL_VALUES.includes(v.goal) &&
    typeof v.sex === 'string' &&
    SEX_VALUES.includes(v.sex) &&
    typeof v.activity === 'string' &&
    ACTIVITY_VALUES.includes(v.activity) &&
    typeof v.age === 'number' &&
    Number.isFinite(v.age) &&
    typeof v.heightCm === 'number' &&
    Number.isFinite(v.heightCm) &&
    typeof v.weightKg === 'number' &&
    Number.isFinite(v.weightKg)
  );
}

export function isWeightEntry(value: unknown): value is WeightEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.day === 'string' &&
    typeof v.loggedAt === 'number' &&
    Number.isFinite(v.loggedAt) &&
    typeof v.kg === 'number' &&
    Number.isFinite(v.kg) &&
    v.kg > 0
  );
}

export type ProfileState = { onboarded: boolean; profile: Profile | null };

/** Stored `{ onboarded, profile }` JSON. Anything unusable means "not onboarded yet". */
export function parseProfileState(raw: string | null | undefined): ProfileState {
  const empty: ProfileState = { onboarded: false, profile: null };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const v = parsed as Record<string, unknown>;
    return { onboarded: v.onboarded === true, profile: isProfile(v.profile) ? v.profile : null };
  } catch {
    return empty;
  }
}

export function isReminder(value: unknown): value is Reminder {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.hour === 'number' &&
    Number.isInteger(v.hour) &&
    v.hour >= 0 &&
    v.hour <= 23 &&
    typeof v.minute === 'number' &&
    Number.isInteger(v.minute) &&
    v.minute >= 0 &&
    v.minute <= 59 &&
    typeof v.enabled === 'boolean'
  );
}

/** Nothing stored (or unreadable) gives the defaults; a stored empty list stays empty. */
export function parseReminders(raw: string | null | undefined): Reminder[] {
  const defaults = DEFAULT_REMINDERS.map((r) => ({ ...r }));
  if (raw === null || raw === undefined) return defaults;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isReminder) : defaults;
  } catch {
    return defaults;
  }
}

/** Parses stored goals JSON; anything unusable becomes the defaults. */
export function parseGoals(raw: string | null | undefined): Goals {
  if (!raw) return { ...DEFAULT_GOALS };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGoals(parsed)
      ? {
          calories: parsed.calories,
          proteinG: parsed.proteinG,
          carbsG: parsed.carbsG,
          fatG: parsed.fatG,
        }
      : { ...DEFAULT_GOALS };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

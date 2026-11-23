import { isUuid, newId, parseProfileState, parseReminders } from './validation';

describe('newId', () => {
  it('produces valid, unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });
});

describe('isUuid', () => {
  it('rejects non-UUID strings', () => {
    expect(isUuid('breakfast')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('1234')).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });
});

describe('parseProfileState', () => {
  const profile = { goal: 'lose', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' };

  it('is not onboarded by default or for garbage', () => {
    const empty = { onboarded: false, profile: null };
    expect(parseProfileState(null)).toEqual(empty);
    expect(parseProfileState('{bad')).toEqual(empty);
    expect(parseProfileState('7')).toEqual(empty);
  });

  it('reads a stored state and drops an invalid profile', () => {
    expect(parseProfileState(JSON.stringify({ onboarded: true, profile }))).toEqual({ onboarded: true, profile });
    expect(parseProfileState(JSON.stringify({ onboarded: true, profile: null }))).toEqual({ onboarded: true, profile: null });
    expect(parseProfileState(JSON.stringify({ onboarded: true, profile: { ...profile, goal: 'nope' } }))).toEqual({
      onboarded: true,
      profile: null,
    });
  });
});

describe('parseReminders', () => {
  it('seeds defaults when nothing is stored, keeps an explicit empty list', () => {
    expect(parseReminders(null).map((r) => r.name)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(parseReminders('[]')).toEqual([]);
    expect(parseReminders('{oops')).toHaveLength(3);
  });
});

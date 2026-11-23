import type { Profile } from '@/data/types';

import { bmr, buildProfile, calculateTargets, tdee } from './targets';

const man: Profile = { goal: 'maintain', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' };
const woman: Profile = { goal: 'maintain', sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'sedentary' };

describe('Mifflin-St Jeor', () => {
  it('computes BMR for a man and a woman', () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(bmr(man)).toBe(1780);
    // 10*60 + 6.25*165 - 5*25 - 161
    expect(bmr(woman)).toBeCloseTo(1345.25, 5);
  });

  it('scales BMR by activity level', () => {
    expect(tdee(man)).toBeCloseTo(2759, 5);
    expect(tdee({ ...man, activity: 'very_active' })).toBeCloseTo(1780 * 1.9, 5);
  });
});

describe('calculateTargets', () => {
  it('cuts 500 kcal to lose weight and sets high protein', () => {
    expect(calculateTargets({ ...man, goal: 'lose' })).toEqual({
      calories: 2259,
      proteinG: 160,
      fatG: 63,
      carbsG: 263,
    });
  });

  it('eats at maintenance, and adds a surplus to gain or build muscle', () => {
    expect(calculateTargets(man).calories).toBe(2759);
    expect(calculateTargets({ ...man, goal: 'gain' }).calories).toBe(3059);
    expect(calculateTargets({ ...man, goal: 'muscle' }).calories).toBe(3009);
  });

  it('never goes below the safe minimum', () => {
    expect(calculateTargets({ ...woman, goal: 'lose' }).calories).toBe(1200);
    expect(calculateTargets({ ...man, goal: 'lose', weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary' }).calories).toBe(1500);
  });

  it('keeps macro calories within rounding of the calorie target', () => {
    for (const goal of ['lose', 'maintain', 'gain', 'muscle'] as const) {
      const t = calculateTargets({ ...man, goal });
      const fromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
      expect(Math.abs(fromMacros - t.calories)).toBeLessThanOrEqual(12);
    }
  });
});

describe('buildProfile', () => {
  const ok = { goal: 'lose', sex: 'female', activity: 'light', age: '34', heightCm: '168', weightKg: '72,5' } as const;

  it('builds a profile from valid form text, accepting comma decimals', () => {
    expect(buildProfile(ok)).toEqual({
      goal: 'lose',
      sex: 'female',
      activity: 'light',
      age: 34,
      heightCm: 168,
      weightKg: 72.5,
    });
  });

  it('returns null while a choice is missing', () => {
    expect(buildProfile({ ...ok, goal: null })).toBeNull();
    expect(buildProfile({ ...ok, sex: null })).toBeNull();
    expect(buildProfile({ ...ok, activity: null })).toBeNull();
  });

  it('rejects empty, non-numeric and out-of-range numbers', () => {
    expect(buildProfile({ ...ok, age: '' })).toBeNull();
    expect(buildProfile({ ...ok, age: '12' })).toBeNull();
    expect(buildProfile({ ...ok, age: '34.5' })).toBeNull();
    expect(buildProfile({ ...ok, heightCm: '90' })).toBeNull();
    expect(buildProfile({ ...ok, heightCm: 'tall' })).toBeNull();
    expect(buildProfile({ ...ok, weightKg: '20' })).toBeNull();
    expect(buildProfile({ ...ok, weightKg: '-70' })).toBeNull();
  });
});

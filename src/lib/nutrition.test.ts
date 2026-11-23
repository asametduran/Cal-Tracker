import { formatEstimate, parseAmount, progressFraction, stepAmount, validateMealForm } from './nutrition';

describe('parseAmount', () => {
  it('parses plain and decimal numbers, including comma decimals', () => {
    expect(parseAmount('420')).toBe(420);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('0')).toBe(0);
  });

  it('rejects empty, negative, non-numeric and non-finite input', () => {
    for (const bad of ['', '   ', '-1', 'abc', '12abc', 'Infinity', 'NaN', '1e999']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
});

describe('validateMealForm', () => {
  const form = { title: 'Eggs', calories: '200', proteinG: '14', carbsG: '2', fatG: '15' };

  it('returns numbers for a valid form and trims the title', () => {
    expect(validateMealForm({ ...form, title: '  Eggs  ' })).toEqual({
      title: 'Eggs',
      calories: 200,
      proteinG: 14,
      carbsG: 2,
      fatG: 15,
    });
  });

  it('rejects a blank title or any invalid number', () => {
    expect(validateMealForm({ ...form, title: '  ' })).toBeNull();
    expect(validateMealForm({ ...form, calories: '' })).toBeNull();
    expect(validateMealForm({ ...form, proteinG: '-3' })).toBeNull();
    expect(validateMealForm({ ...form, fatG: 'lots' })).toBeNull();
  });
});

describe('formatEstimate', () => {
  it('rounds the model numbers to whole numbers as strings', () => {
    expect(
      formatEstimate({ title: 'Bowl', calories: 640.4, proteinG: 41.6, carbsG: 68, fatG: 22.2 }),
    ).toEqual({ title: 'Bowl', calories: '640', proteinG: '42', carbsG: '68', fatG: '22' });
  });
});

describe('stepAmount', () => {
  it('adds the delta and never goes below zero', () => {
    expect(stepAmount('100', 25)).toBe('125');
    expect(stepAmount('10', -25)).toBe('0');
  });

  it('treats unparseable text as zero', () => {
    expect(stepAmount('', 5)).toBe('5');
    expect(stepAmount('abc', 5)).toBe('5');
  });
});

describe('progressFraction', () => {
  it('clamps to 0..1', () => {
    expect(progressFraction(500, 2000)).toBe(0.25);
    expect(progressFraction(3000, 2000)).toBe(1);
    expect(progressFraction(-5, 2000)).toBe(0);
  });

  it('is 0 when the goal is 0', () => {
    expect(progressFraction(100, 0)).toBe(0);
  });
});

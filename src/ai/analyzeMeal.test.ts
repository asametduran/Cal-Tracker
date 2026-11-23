import { analyzeMeal, resolveBackend } from './analyzeMeal';
import type { PhotoInput } from './types';

const photo: PhotoInput = { uri: 'file:///meal.jpg', base64: 'AAAA', mimeType: 'image/jpeg' };

describe('resolveBackend', () => {
  it('defaults to mock', () => {
    expect(resolveBackend(undefined)).toBe('mock');
    expect(resolveBackend('')).toBe('mock');
    expect(resolveBackend('nonsense')).toBe('mock');
  });

  it('accepts mock and proxy in development', () => {
    expect(resolveBackend('mock')).toBe('mock');
    expect(resolveBackend('proxy')).toBe('proxy');
  });

  it('no longer supports a direct client-side Gemini backend', () => {
    expect(resolveBackend('gemini', true, false)).toBe('mock');
    expect(resolveBackend('gemini', true, true)).toBe('proxy');
  });

  it('defaults to the proxy when Supabase is configured, else the offline mock', () => {
    expect(resolveBackend(undefined, true, true)).toBe('proxy');
    expect(resolveBackend('nonsense', true, true)).toBe('proxy');
    expect(resolveBackend(undefined, true, false)).toBe('mock');
  });

  it('always uses the proxy in release builds, whatever the env says', () => {
    expect(resolveBackend('gemini', false, true)).toBe('proxy');
    expect(resolveBackend('mock', false, true)).toBe('proxy');
    expect(resolveBackend('mock', false, false)).toBe('proxy');
    expect(resolveBackend(undefined, false, false)).toBe('proxy');
  });
});

describe('analyzeMeal', () => {
  it('returns a well-formed estimate from the mock backend', async () => {
    jest.useFakeTimers();
    const pending = analyzeMeal(photo, 'mock');
    await jest.runAllTimersAsync();
    const result = await pending;
    jest.useRealTimers();
    expect(result.title.length).toBeGreaterThan(0);
    for (const n of [result.calories, result.proteinG, result.carbsG, result.fatG]) {
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('proxy backend reports missing_config when Supabase is not set up', async () => {
    await expect(analyzeMeal(photo, 'proxy')).rejects.toMatchObject({ code: 'missing_config' });
  });
});

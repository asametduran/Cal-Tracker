import { isSupabaseConfigured } from '@/lib/supabase';

import { analyzeWithMock } from './backends/mock';
import { analyzeWithProxy } from './backends/proxy';
import type { MealEstimate, PhotoInput } from './types';

export type BackendName = 'mock' | 'proxy';

/**
 * Release builds always use the proxy (the Supabase Edge Function that holds the Gemini key), so no AI key
 * can ship in the app. In development, EXPO_PUBLIC_AI_BACKEND wins; when unset it is the proxy if Supabase
 * is configured, else the offline mock.
 */
export function resolveBackend(
  value: string | undefined,
  dev: boolean = __DEV__,
  configured: boolean = isSupabaseConfigured,
): BackendName {
  if (!dev) return 'proxy';
  if (value === 'mock' || value === 'proxy') return value;
  return configured ? 'proxy' : 'mock';
}

/** The only AI entry point screens may use. */
export async function analyzeMeal(
  photo: PhotoInput,
  backend: BackendName = resolveBackend(process.env.EXPO_PUBLIC_AI_BACKEND),
): Promise<MealEstimate> {
  return backend === 'proxy' ? analyzeWithProxy(photo) : analyzeWithMock(photo);
}

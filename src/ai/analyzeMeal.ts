import { isSupabaseConfigured } from '@/lib/supabase';

import { analyzeWithMock } from './backends/mock';
import { analyzeWithProxy } from './backends/proxy';
import { AnalyzeError, type MealEstimate, type PhotoInput } from './types';

export type BackendName = 'mock' | 'gemini' | 'proxy';

/**
 * Release builds always use the proxy, so no Gemini key ever ships in the app. In development,
 * EXPO_PUBLIC_AI_BACKEND wins; when unset it is the proxy if Supabase is configured, else the offline mock.
 */
export function resolveBackend(
  value: string | undefined,
  dev: boolean = __DEV__,
  configured: boolean = isSupabaseConfigured,
): BackendName {
  if (!dev) return 'proxy';
  if (value === 'mock' || value === 'gemini' || value === 'proxy') return value;
  return configured ? 'proxy' : 'mock';
}

/** The only AI entry point screens may use. */
export async function analyzeMeal(
  photo: PhotoInput,
  backend: BackendName = resolveBackend(process.env.EXPO_PUBLIC_AI_BACKEND),
): Promise<MealEstimate> {
  switch (backend) {
    case 'proxy':
      return analyzeWithProxy(photo);
    case 'gemini': {
      if (__DEV__) {
        // Required lazily inside a __DEV__ branch: production bundles drop this branch, so the
        // direct-Gemini code and EXPO_PUBLIC_GEMINI_API_KEY never reach a shipped app.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { analyzeWithGemini } = require('./backends/gemini') as typeof import('./backends/gemini');
        return analyzeWithGemini(photo);
      }
      throw new AnalyzeError('unsupported_build', 'The direct Gemini backend is for development builds only.');
    }
    default:
      return analyzeWithMock(photo);
  }
}

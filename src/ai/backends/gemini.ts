import {
  buildGeminiBody,
  parseGeminiReply,
  tidyTitle,
} from '../../../supabase/functions/_shared/meal';
import { AnalyzeError, type MealEstimate, type PhotoInput } from '../types';

export { tidyTitle };

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiOptions = {
  apiKey?: string;
  model?: string;
  isDev?: boolean;
  fetchImpl?: typeof fetch;
};

/**
 * Direct-from-device Gemini call. DEVELOPMENT ONLY: any key bundled into the app is extractable.
 * It is loaded lazily behind a `__DEV__` check in analyzeMeal.ts so production bundles contain
 * neither this code nor the key. Release builds use the proxy backend instead.
 */
export async function analyzeWithGemini(photo: PhotoInput, options: GeminiOptions = {}): Promise<MealEstimate> {
  const isDev = options.isDev ?? __DEV__;
  if (!isDev) {
    throw new AnalyzeError(
      'unsupported_build',
      'The direct Gemini backend is for development builds only. Use the proxy backend.',
    );
  }

  // Literal property access so Expo inlines the variables at bundle time.
  const apiKey = options.apiKey ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  if (!apiKey) {
    throw new AnalyzeError(
      'missing_key',
      'EXPO_PUBLIC_GEMINI_API_KEY is not set. Add it to .env.local and restart Expo.',
    );
  }
  const model = options.model ?? process.env.EXPO_PUBLIC_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiBody(photo.base64, photo.mimeType)),
    });
  } catch {
    throw new AnalyzeError('network', 'Could not reach the AI service. Check your connection.');
  }

  if (!response.ok) {
    throw new AnalyzeError('network', `The AI service returned an error (HTTP ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AnalyzeError('bad_response', 'The AI service sent an unreadable response.');
  }

  const parsed = parseGeminiReply(data);
  if (!parsed.ok) {
    if (parsed.code === 'not_food') {
      throw new AnalyzeError('not_food', "That doesn't look like food. Try another photo.");
    }
    throw new AnalyzeError('bad_response', 'The AI result was missing nutrition data.');
  }
  return parsed.estimate;
}

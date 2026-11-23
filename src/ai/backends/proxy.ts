import { supabase } from '@/lib/supabase';

import { tidyTitle } from '../../../supabase/functions/_shared/meal';
import { AnalyzeError, estimateSchema, type MealEstimate, type PhotoInput } from '../types';

export type InvokeResult = { data: unknown; error: unknown };

export type ProxyOptions = {
  /** Injectable for tests. Defaults to calling the `analyze-meal` Edge Function as the signed-in user. */
  invoke?: (body: { image: string; mimeType: string }) => Promise<InvokeResult>;
};

async function defaultInvoke(body: { image: string; mimeType: string }): Promise<InvokeResult> {
  if (!supabase) {
    throw new AnalyzeError(
      'missing_config',
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  // The client attaches the signed-in user's JWT automatically.
  return supabase.functions.invoke('analyze-meal', { body });
}

type ServerError = { status?: number; code?: string; message?: string };

async function readServerError(error: unknown): Promise<ServerError> {
  const context = (error as { context?: { status?: number; json?: () => Promise<unknown> } } | null)?.context;
  if (!context || typeof context.json !== 'function') return {};
  try {
    const body = (await context.json()) as { code?: unknown; message?: unknown } | null;
    return {
      status: context.status,
      code: typeof body?.code === 'string' ? body.code : undefined,
      message: typeof body?.message === 'string' ? body.message : undefined,
    };
  } catch {
    return { status: context.status };
  }
}

async function toAnalyzeError(error: unknown): Promise<AnalyzeError> {
  const { status, code, message } = await readServerError(error);
  if (status === undefined) {
    return new AnalyzeError('network', 'Could not reach the AI service. Check your connection.');
  }
  if (status === 401 || code === 'unauthorized') {
    return new AnalyzeError('unauthorized', 'Please sign in again to analyze meals.');
  }
  if (code === 'not_food') {
    return new AnalyzeError('not_food', message ?? "That doesn't look like food. Try another photo.");
  }
  if (status === 429 || code === 'rate_limited') {
    return new AnalyzeError('rate_limited', "You've reached today's scan limit. Enter the meal manually or try again tomorrow.");
  }
  return new AnalyzeError('bad_response', 'The AI service had a problem. Please try again.');
}

/**
 * Release backend. The photo goes to the `analyze-meal` Supabase Edge Function, which holds the
 * Gemini key server-side. Nothing secret is in the app.
 */
export async function analyzeWithProxy(photo: PhotoInput, options: ProxyOptions = {}): Promise<MealEstimate> {
  const invoke = options.invoke ?? defaultInvoke;
  const { data, error } = await invoke({ image: photo.base64, mimeType: photo.mimeType });
  if (error) throw await toAnalyzeError(error);

  const parsed = estimateSchema.safeParse(data);
  if (!parsed.success) throw new AnalyzeError('bad_response', 'The AI result was missing nutrition data.');
  const { title, calories, proteinG, carbsG, fatG } = parsed.data;
  return { title: tidyTitle(title), calories, proteinG, carbsG, fatG };
}

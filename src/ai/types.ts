import { z } from 'zod';

export type PhotoInput = {
  uri: string;
  base64: string;
  mimeType: string;
};

export type MealEstimate = {
  title: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type AnalyzeErrorCode =
  | 'missing_key'
  | 'missing_config'
  | 'unauthorized'
  | 'rate_limited'
  | 'not_food'
  | 'bad_response'
  | 'network'
  | 'unsupported_build'
  | 'not_implemented';

export class AnalyzeError extends Error {
  readonly code: AnalyzeErrorCode;

  constructor(code: AnalyzeErrorCode, message: string) {
    super(message);
    this.name = 'AnalyzeError';
    this.code = code;
  }
}

const nonNegative = z.number().finite().min(0);

/** Shape the model must return. `isFood` lets the model reject non-food photos. */
/** What the proxy (Edge Function) returns: the estimate without `isFood`. */
export const estimateSchema = z.object({
  title: z.string().trim().min(1),
  calories: nonNegative,
  proteinG: nonNegative,
  carbsG: nonNegative,
  fatG: nonNegative,
});

export const modelResponseSchema = z.object({
  isFood: z.boolean(),
  title: z.string().trim().min(1),
  calories: nonNegative,
  proteinG: nonNegative,
  carbsG: nonNegative,
  fatG: nonNegative,
});

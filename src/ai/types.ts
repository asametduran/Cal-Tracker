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
  | 'missing_config'
  | 'unauthorized'
  | 'rate_limited'
  | 'not_food'
  | 'bad_response'
  | 'network';

export class AnalyzeError extends Error {
  readonly code: AnalyzeErrorCode;

  constructor(code: AnalyzeErrorCode, message: string) {
    super(message);
    this.name = 'AnalyzeError';
    this.code = code;
  }
}

const nonNegative = z.number().finite().min(0);

/** What the proxy (Edge Function) returns, re-validated on the client before it is trusted. */
export const estimateSchema = z.object({
  title: z.string().trim().min(1),
  calories: nonNegative,
  proteinG: nonNegative,
  carbsG: nonNegative,
  fatG: nonNegative,
});

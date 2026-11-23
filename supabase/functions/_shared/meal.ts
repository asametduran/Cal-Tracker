// Pure helpers shared by the `analyze-meal` Edge Function (Deno) and the dev-only client backend.
// No imports and no Deno/browser globals, so it runs anywhere and is unit tested with Jest.

export type MealEstimate = {
  title: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Base64 characters. 8M chars is roughly a 6 MB image, far more than a resized meal photo needs. */
export const MAX_IMAGE_BASE64_CHARS = 8_000_000;

export const MAX_TITLE_CHARS = 40;

export const PROMPT = [
  'You are a nutrition analyst. Look at the photo and estimate the meal shown.',
  'If the photo does not show food or drink, set isFood to false and all numbers to 0.',
  'Otherwise give the total estimated calories (kcal)',
  'and grams of protein, carbohydrates and fat for the whole portion visible.',
  'The title must be a concise dish name of at most 4 words and 28 characters',
  '(for example "Chicken burrito bowl" or "Avocado toast with egg"),',
  'with no brand names, quantities, adjectives like "delicious", or extra punctuation,',
  'so it always fits on two short lines.',
  'Respond only with JSON matching the schema.',
].join(' ');

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    title: { type: 'STRING' },
    calories: { type: 'NUMBER' },
    proteinG: { type: 'NUMBER' },
    carbsG: { type: 'NUMBER' },
    fatG: { type: 'NUMBER' },
  },
  required: ['isFood', 'title', 'calories', 'proteinG', 'carbsG', 'fatG'],
};

/** Collapses whitespace and trims to a length that fits two lines, cutting at a word boundary. */
export function tidyTitle(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_TITLE_CHARS) return text;
  const cut = text.slice(0, MAX_TITLE_CHARS - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Body for Gemini's `generateContent`: the image inline plus a JSON response schema. */
export function buildGeminiBody(imageBase64: string, mimeType: string) {
  return {
    contents: [
      {
        parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };
}

export type ParsedReply = { ok: true; estimate: MealEstimate } | { ok: false; code: 'not_food' | 'bad_response' };

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100_000;
}

/** Validates the full Gemini API response and extracts the estimate. */
export function parseGeminiReply(data: unknown): ParsedReply {
  const bad = { ok: false, code: 'bad_response' } as const;
  const candidates = (data as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(candidates)) return bad;
  const text = (candidates[0] as { content?: { parts?: { text?: unknown }[] } } | undefined)?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return bad;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return bad;
  }
  if (typeof parsed !== 'object' || parsed === null) return bad;
  const v = parsed as Record<string, unknown>;

  if (typeof v.isFood !== 'boolean' || typeof v.title !== 'string') return bad;
  if (!isAmount(v.calories) || !isAmount(v.proteinG) || !isAmount(v.carbsG) || !isAmount(v.fatG)) return bad;
  if (!v.isFood) return { ok: false, code: 'not_food' };

  const title = tidyTitle(v.title);
  if (title === '') return bad;
  return { ok: true, estimate: { title, calories: v.calories, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG } };
}

export type RequestCheck = { ok: true; image: string; mimeType: string } | { ok: false; message: string };

/** Validates the JSON body sent to the Edge Function. */
export function validateRequestBody(body: unknown): RequestCheck {
  if (typeof body !== 'object' || body === null) return { ok: false, message: 'Send a JSON object.' };
  const { image, mimeType } = body as { image?: unknown; mimeType?: unknown };
  if (typeof image !== 'string' || image.length === 0) return { ok: false, message: 'Missing "image" (base64).' };
  if (image.length > MAX_IMAGE_BASE64_CHARS) return { ok: false, message: 'Image is too large.' };
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(image)) return { ok: false, message: '"image" must be base64 without a data: prefix.' };
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { ok: false, message: 'Unsupported image type.' };
  }
  return { ok: true, image, mimeType };
}

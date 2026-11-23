import type { MealEstimate, PhotoInput } from '../types';

const SAMPLES: MealEstimate[] = [
  { title: 'Grilled chicken bowl', calories: 620, proteinG: 48, carbsG: 62, fatG: 18 },
  { title: 'Avocado toast with egg', calories: 410, proteinG: 17, carbsG: 38, fatG: 22 },
  { title: 'Pepperoni pizza slice', calories: 310, proteinG: 13, carbsG: 34, fatG: 14 },
  { title: 'Greek yogurt with berries', calories: 190, proteinG: 17, carbsG: 24, fatG: 3 },
];

let next = 0;

/** Offline stand-in for the AI. Cycles through a few plausible meals. */
export async function analyzeWithMock(
  _photo: PhotoInput,
  options: { delayMs?: number } = {},
): Promise<MealEstimate> {
  const delayMs = options.delayMs ?? 700;
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  const sample = SAMPLES[next % SAMPLES.length];
  next += 1;
  return { ...sample };
}

import { analyzeWithProxy, type InvokeResult } from './proxy';
import type { PhotoInput } from '../types';

const photo: PhotoInput = { uri: 'file:///meal.jpg', base64: 'AAAA', mimeType: 'image/jpeg' };
const estimate = { title: 'Chicken burrito bowl', calories: 640, proteinG: 42, carbsG: 68, fatG: 22 };

const ok = (data: unknown) => jest.fn(async (): Promise<InvokeResult> => ({ data, error: null }));
const httpError = (status: number, body: unknown) =>
  jest.fn(
    async (): Promise<InvokeResult> => ({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status, json: async () => body } },
    }),
  );

describe('analyzeWithProxy', () => {
  it('sends only the image and type, and returns the estimate', async () => {
    const invoke = ok(estimate);
    await expect(analyzeWithProxy(photo, { invoke })).resolves.toEqual(estimate);
    expect(invoke).toHaveBeenCalledWith({ image: 'AAAA', mimeType: 'image/jpeg' });
  });

  it('keeps titles short even if the server sends a long one', async () => {
    const long = 'Slow roasted garlic herb crusted chicken breast with creamy mashed potatoes and gravy';
    const result = await analyzeWithProxy(photo, { invoke: ok({ ...estimate, title: long }) });
    expect(result.title.length).toBeLessThanOrEqual(40);
  });

  it('maps server errors to AnalyzeError codes', async () => {
    await expect(
      analyzeWithProxy(photo, { invoke: httpError(422, { code: 'not_food', message: 'Not food!' }) }),
    ).rejects.toMatchObject({ code: 'not_food', message: 'Not food!' });
    await expect(
      analyzeWithProxy(photo, { invoke: httpError(401, { code: 'unauthorized' }) }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(
      analyzeWithProxy(photo, { invoke: httpError(429, { code: 'rate_limited' }) }),
    ).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(
      analyzeWithProxy(photo, { invoke: httpError(502, { code: 'upstream_error' }) }),
    ).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('reports a network error when the request never reached the server', async () => {
    const invoke = jest.fn(async (): Promise<InvokeResult> => ({ data: null, error: new Error('Failed to fetch') }));
    await expect(analyzeWithProxy(photo, { invoke })).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects a reply that is missing nutrition data', async () => {
    await expect(analyzeWithProxy(photo, { invoke: ok({ title: 'x' }) })).rejects.toMatchObject({
      code: 'bad_response',
    });
    await expect(analyzeWithProxy(photo, { invoke: ok({ ...estimate, calories: -5 }) })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('reports missing_config when Supabase is not set up and nothing is injected', async () => {
    await expect(analyzeWithProxy(photo)).rejects.toMatchObject({ code: 'missing_config' });
  });
});

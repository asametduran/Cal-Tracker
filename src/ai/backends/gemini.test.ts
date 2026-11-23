import { analyzeWithGemini, tidyTitle } from './gemini';
import { AnalyzeError, type PhotoInput } from '../types';

const photo: PhotoInput = { uri: 'file:///meal.jpg', base64: 'AAAA', mimeType: 'image/jpeg' };

function geminiReply(payload: unknown, ok = true, status = 200): typeof fetch {
  return jest.fn(async () => ({
    ok,
    status,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  })) as unknown as typeof fetch;
}

const valid = {
  isFood: true,
  title: 'Chicken burrito bowl',
  calories: 640,
  proteinG: 42,
  carbsG: 68,
  fatG: 22,
};

describe('concise titles', () => {
  it('asks the model for a short dish name in the prompt', async () => {
    const fetchImpl = geminiReply(valid);
    await analyzeWithGemini(photo, { apiKey: 'k', fetchImpl });
    const body = JSON.parse((fetchImpl as jest.Mock).mock.calls[0][1].body);
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain('at most 4 words');
    expect(prompt).toContain('two short lines');
  });

  it('trims an overly long model title at a word boundary', async () => {
    const long = 'Slow roasted garlic herb crusted chicken breast with creamy mashed potatoes and gravy';
    const result = await analyzeWithGemini(photo, {
      apiKey: 'k',
      fetchImpl: geminiReply({ ...valid, title: long }),
    });
    expect(result.title.length).toBeLessThanOrEqual(40);
    expect(result.title.endsWith('…')).toBe(true);
    expect(long.startsWith(result.title.slice(0, -1))).toBe(true);
  });

  it('tidyTitle collapses whitespace and leaves short titles alone', () => {
    expect(tidyTitle('  Chicken   burrito\n bowl ')).toBe('Chicken burrito bowl');
    expect(tidyTitle('Avocado toast')).toBe('Avocado toast');
  });
});

describe('analyzeWithGemini', () => {
  it('returns a MealEstimate for a valid response', async () => {
    const result = await analyzeWithGemini(photo, { apiKey: 'k', fetchImpl: geminiReply(valid) });
    expect(result).toEqual({
      title: 'Chicken burrito bowl',
      calories: 640,
      proteinG: 42,
      carbsG: 68,
      fatG: 22,
    });
  });

  it('sends the image inline, the key in a header, and a JSON schema', async () => {
    const fetchImpl = geminiReply(valid);
    await analyzeWithGemini(photo, { apiKey: 'secret', model: 'test-model', fetchImpl });
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toContain('/models/test-model:generateContent');
    expect(url).not.toContain('secret');
    expect(init.headers['x-goog-api-key']).toBe('secret');
    const body = JSON.parse(init.body);
    const parts = body.contents[0].parts;
    expect(
      parts.some((p: any) => p.inline_data?.data === 'AAAA' && p.inline_data?.mime_type === 'image/jpeg'),
    ).toBe(true);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
  });

  it('defaults the model to gemini-3.8-flash', async () => {
    const fetchImpl = geminiReply(valid);
    await analyzeWithGemini(photo, { apiKey: 'k', fetchImpl });
    expect((fetchImpl as jest.Mock).mock.calls[0][0]).toContain('/models/gemini-3.8-flash:generateContent');
  });

  it('throws missing_key when no API key is configured', async () => {
    await expect(
      analyzeWithGemini(photo, { apiKey: '', fetchImpl: geminiReply(valid) }),
    ).rejects.toMatchObject({
      code: 'missing_key',
    });
  });

  it('throws unsupported_build outside dev builds', async () => {
    await expect(
      analyzeWithGemini(photo, { apiKey: 'k', isDev: false, fetchImpl: geminiReply(valid) }),
    ).rejects.toMatchObject({ code: 'unsupported_build' });
  });

  it('throws not_food when the model says the photo is not food', async () => {
    const reply = geminiReply({ ...valid, isFood: false });
    await expect(analyzeWithGemini(photo, { apiKey: 'k', fetchImpl: reply })).rejects.toMatchObject({
      code: 'not_food',
    });
  });

  it('throws bad_response for negative numbers', async () => {
    const reply = geminiReply({ ...valid, calories: -5 });
    await expect(analyzeWithGemini(photo, { apiKey: 'k', fetchImpl: reply })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('throws bad_response when the text is not JSON', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry, no' }] } }] }),
    })) as unknown as typeof fetch;
    const result = analyzeWithGemini(photo, { apiKey: 'k', fetchImpl });
    await expect(result).rejects.toBeInstanceOf(AnalyzeError);
    await expect(result).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('throws bad_response when there are no candidates', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(analyzeWithGemini(photo, { apiKey: 'k', fetchImpl })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it('throws network on a non-ok HTTP status', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(analyzeWithGemini(photo, { apiKey: 'k', fetchImpl })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('throws network when fetch itself rejects', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(analyzeWithGemini(photo, { apiKey: 'k', fetchImpl })).rejects.toMatchObject({
      code: 'network',
    });
  });
});

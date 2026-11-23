import {
  MAX_IMAGE_BASE64_CHARS,
  buildGeminiBody,
  detectImageType,
  parseGeminiReply,
  tidyTitle,
  validateRequestBody,
} from './meal';

const reply = (payload: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] });
const good = { isFood: true, title: 'Chicken burrito bowl', calories: 640, proteinG: 42, carbsG: 68, fatG: 22 };

describe('buildGeminiBody', () => {
  it('sends the image inline with a JSON schema and a conciseness instruction', () => {
    const body = buildGeminiBody('AAAA', 'image/jpeg');
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toContain('title');
    expect((body.contents[0].parts[0] as { text: string }).text).toContain('at most 4 words');
  });
});

describe('parseGeminiReply', () => {
  it('returns the estimate for a valid reply', () => {
    expect(parseGeminiReply(reply(good))).toEqual({
      ok: true,
      estimate: { title: 'Chicken burrito bowl', calories: 640, proteinG: 42, carbsG: 68, fatG: 22 },
    });
  });

  it('flags non-food photos', () => {
    expect(parseGeminiReply(reply({ ...good, isFood: false }))).toEqual({ ok: false, code: 'not_food' });
  });

  it('rejects malformed replies', () => {
    const bad = { ok: false, code: 'bad_response' };
    expect(parseGeminiReply(null)).toEqual(bad);
    expect(parseGeminiReply({})).toEqual(bad);
    expect(parseGeminiReply({ candidates: [] })).toEqual(bad);
    expect(parseGeminiReply({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] })).toEqual(bad);
    expect(parseGeminiReply(reply({ ...good, calories: -1 }))).toEqual(bad);
    expect(parseGeminiReply(reply({ ...good, proteinG: 'lots' }))).toEqual(bad);
    expect(parseGeminiReply(reply({ ...good, calories: 1e9 }))).toEqual(bad);
    expect(parseGeminiReply(reply({ ...good, title: '   ' }))).toEqual(bad);
    expect(parseGeminiReply(reply({ title: 'x' }))).toEqual(bad);
  });

  it('trims long titles so they fit two lines', () => {
    const long = 'Slow roasted garlic herb crusted chicken breast with creamy mashed potatoes and gravy';
    const result = parseGeminiReply(reply({ ...good, title: long }));
    expect(result.ok && result.estimate.title.length).toBeLessThanOrEqual(40);
    expect(result.ok && result.estimate.title.endsWith('…')).toBe(true);
  });
});

describe('tidyTitle', () => {
  it('collapses whitespace and leaves short titles alone', () => {
    expect(tidyTitle('  Chicken   burrito\n bowl ')).toBe('Chicken burrito bowl');
    expect(tidyTitle('Avocado toast')).toBe('Avocado toast');
  });
});

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii('JFIF'), 0, 1, 1, 0]);
const PNG = b64([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = b64([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBPVP8 ')]);
const HEIC = b64([0, 0, 0, 0x18, ...ascii('ftypheic'), 0, 0, 0, 0]);
const HEIF = b64([0, 0, 0, 0x18, ...ascii('ftypmif1'), 0, 0, 0, 0]);

describe('detectImageType', () => {
  it('recognises JPEG, PNG, WebP and HEIC/HEIF by their first bytes', () => {
    expect(JPEG.startsWith('/9j/')).toBe(true);
    expect(PNG.startsWith('iVBOR')).toBe(true);
    expect(WEBP.startsWith('UklGR')).toBe(true);
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(HEIC)).toBe('image/heic');
    expect(detectImageType(HEIF)).toBe('image/heic');
  });

  it('rejects other content: PDFs, scripts, RIFF that is not WebP, garbage and empty data', () => {
    expect(detectImageType(Buffer.from('%PDF-1.7 fake pdf content').toString('base64'))).toBeNull();
    expect(detectImageType(Buffer.from('<script>alert(1)</script>').toString('base64'))).toBeNull();
    expect(detectImageType(b64([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVEfmt ')]))).toBeNull();
    expect(detectImageType('!!!!')).toBeNull();
    expect(detectImageType('')).toBeNull();
  });
});

describe('validateRequestBody', () => {
  it('accepts a base64 image whose bytes match the stated type', () => {
    expect(validateRequestBody({ image: JPEG, mimeType: 'image/jpeg' })).toEqual({ ok: true, image: JPEG, mimeType: 'image/jpeg' });
    expect(validateRequestBody({ image: PNG, mimeType: 'image/png' }).ok).toBe(true);
    expect(validateRequestBody({ image: WEBP, mimeType: 'image/webp' }).ok).toBe(true);
    expect(validateRequestBody({ image: HEIC, mimeType: 'image/heic' }).ok).toBe(true);
    expect(validateRequestBody({ image: HEIF, mimeType: 'image/heif' }).ok).toBe(true);
  });

  it('rejects a non-image or a mismatched type even when the claimed type is allowed', () => {
    const pdf = Buffer.from('%PDF-1.7 fake pdf content').toString('base64');
    expect(validateRequestBody({ image: pdf, mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: 'AAAA', mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: PNG, mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: JPEG, mimeType: 'image/webp' }).ok).toBe(false);
  });

  it('rejects missing, oversized, non-base64 and wrongly typed input', () => {
    expect(validateRequestBody(null).ok).toBe(false);
    expect(validateRequestBody({}).ok).toBe(false);
    expect(validateRequestBody({ image: '', mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 1), mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' }).ok).toBe(false);
    expect(validateRequestBody({ image: 'AAAA', mimeType: 'application/pdf' }).ok).toBe(false);
    expect(validateRequestBody({ image: 'AAAA' }).ok).toBe(false);
  });
});

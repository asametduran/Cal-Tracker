// Supabase Edge Function: analyze-meal
//
// Receives a meal photo from a signed-in user, asks Gemini to estimate calories and macros, and
// returns structured JSON. The Gemini API key lives only in the function's server-side secrets
// (`supabase secrets set GEMINI_API_KEY=...`) and never reaches the app.
//
// POST { image: <base64, no data: prefix>, mimeType: "image/jpeg" | ... }
//  -> 200 { title, calories, proteinG, carbsG, fatG }
//  -> 4xx/5xx { code, message }

import { createClient } from 'npm:@supabase/supabase-js@2';

import { buildGeminiBody, parseGeminiReply, validateRequestBody } from '../_shared/meal.ts';

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '60');
/** Scans allowed per user per minute. */
const BURST_LIMIT = Number(Deno.env.get('AI_BURST_LIMIT') ?? '6');
/** Request bodies above this are rejected unread (8M chars of base64 image plus JSON overhead). */
const MAX_BODY_CHARS = 8_500_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Access is gated by the user's JWT, not by origin.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed', message: 'Use POST.' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { code: 'unauthorized', message: 'Sign in to analyze meals.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !geminiKey) {
    console.error('analyze-meal: missing server configuration');
    return json(500, { code: 'server_misconfigured', message: 'The AI service is not configured.' });
  }

  // Who is calling? Verify the JWT with Supabase Auth rather than trusting the header.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user)
    return json(401, { code: 'unauthorized', message: 'Sign in to analyze meals.' });

  // Refuse oversized bodies before buffering them (the image limit in validateRequestBody is ~8M chars).
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_CHARS)
    return json(413, { code: 'payload_too_large', message: 'That photo is too large.' });
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS)
    return json(413, { code: 'payload_too_large', message: 'That photo is too large.' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { code: 'bad_request', message: 'Send a JSON body.' });
  }
  const request = validateRequestBody(body);
  if (!request.ok) return json(400, { code: 'bad_request', message: request.message });

  // Per-user daily quota and per-minute burst limit, enforced with the service role so clients can't
  // touch the counters. Fails closed: if the check errors, nothing is sent to Gemini.
  const admin = createClient(supabaseUrl, serviceKey);
  const userId = userData.user.id;
  const { data: verdict, error: quotaError } = await admin.rpc('consume_ai_scan', {
    p_user: userId,
    p_daily_limit: DAILY_LIMIT,
    p_burst_limit: BURST_LIMIT,
  });
  if (quotaError) {
    console.error('analyze-meal: quota check failed', quotaError.message);
    return json(500, { code: 'server_error', message: 'Could not check your usage. Try again.' });
  }
  if (verdict === 'burst') {
    return json(
      429,
      { code: 'rate_limited', message: 'Too many scans at once. Wait a minute and try again.' },
      { 'Retry-After': '60' },
    );
  }
  if (verdict !== 'ok') {
    return json(429, { code: 'rate_limited', message: "You've reached today's scan limit. Try again tomorrow." });
  }

  // The user got nothing from a failed provider call, so give the daily scan back.
  const refund = async () => {
    const { error } = await admin.rpc('refund_ai_scan', { p_user: userId });
    if (error) console.error('analyze-meal: refund failed', error.message);
  };

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify(buildGeminiBody(request.image, request.mimeType)),
      },
    );
  } catch {
    await refund();
    return json(502, { code: 'upstream_error', message: 'The AI service could not be reached.' });
  }
  if (!upstream.ok) {
    console.error('analyze-meal: Gemini returned', upstream.status);
    await refund();
    return json(502, { code: 'upstream_error', message: 'The AI service had a problem. Try again.' });
  }

  const parsed = parseGeminiReply(await upstream.json().catch(() => null));
  if (!parsed.ok) {
    if (parsed.code === 'not_food') {
      return json(422, { code: 'not_food', message: "That doesn't look like food. Try another photo." });
    }
    await refund();
    return json(502, { code: 'upstream_error', message: 'The AI result was not usable. Try again.' });
  }
  return json(200, parsed.estimate);
});

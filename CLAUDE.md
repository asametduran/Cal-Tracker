# Cal Tracker

A Cal AI-style calorie tracker. Photo of a meal -> AI estimates calories and macros -> user adjusts -> saved to today's totals. Expo + React Native + TypeScript, Expo Router, for iOS, Android and web.

Read `AGENTS.md` first for Expo rules (use `npx expo install`, check versioned docs before using Expo APIs).
Design: `docs/superpowers/specs/2026-11-23-cal-tracker-design.md`. Plan: `docs/superpowers/plans/2026-11-23-cal-tracker-mvp.md`.

## How we build: staged framework (in this order, do not skip ahead)

1. Core function: photo -> `analyzeMeal` -> calories + macros.
2. Core loop: hit daily calorie and macro goals; a visual and haptic reward on every save.
3. Accessory features.
4. Minimize surface area.
5. Retention hook, last.

Details and current status: `docs/stages.md`. Do not add a stage-3+ feature while stage 1 or 2 is incomplete.

## Surface area budget

Stage 3 (owner-approved) grew the app from 3 screens to three tabs plus three stack screens. Keep it at this size; ask before adding another.
- Tabs (`src/app/(tabs)/`): Today (`index.tsx`, with day navigation), Progress (`progress.tsx`, monthly calendar), Settings (`settings.tsx`, goals + meal reminders).
- Stack screens: Capture (`capture.tsx`), Review (`review.tsx`, AI estimate), Meal (`meal.tsx`, view/edit/delete a meal or add one manually), Weight (`weight.tsx`, log/edit/delete a weigh-in), Onboarding (`onboarding.tsx`, first-run questions; `?mode=recalc` from Settings).
- The main `+` button on Today opens `AddMenu` (scan meal, enter meal, log weight) for the viewed day. The tab layout redirects to onboarding until `repositories.profile.isOnboarded()`.
- Daily targets come from `src/lib/targets.ts` (Mifflin-St Jeor BMR x activity, goal adjustment, protein by body weight, 25% fat). Units are metric (kg, cm).
- Design: light Cal AI-style look (white cards on a pale background, navy ink, flame-orange streaks, soft shadows). Palette, `shadow` and spacing tokens live in `src/theme.ts`; icons are SVG in `src/components/Icon.tsx`. Use tonal surfaces and `shadow.card`, not borders. Don't hard-code colours. Give a `ScrollView` inside an `alignItems: 'center'` screen `style={{ width: '100%' }}`, or its content overflows on web.
- The day being viewed travels as a `day` (`YYYY-MM-DD`) route param. Always pass it through `resolveDay()` (it clamps to today and rejects garbage).

## Architecture rules

- Screens call AI only through `analyzeMeal` (`src/ai/analyzeMeal.ts`). Never import a backend directly.
- Screens read and write data only through `repositories` from `@/data`. Never import `expo-sqlite` or `localStorage` in a screen.
- Storage is platform-split: `src/data/repositories.ts` (expo-sqlite, native) and `src/data/repositories.web.ts` (localStorage, web). Both implement the same interfaces in `src/data/types.ts`.
- AI backend: release builds ALWAYS use `proxy` (Supabase Edge Function `analyze-meal`, which holds the Gemini key server-side). In dev, `EXPO_PUBLIC_AI_BACKEND` (`mock` | `proxy`) wins; unset = proxy if Supabase is configured, else mock. There is NO client-side Gemini backend and no `EXPO_PUBLIC_GEMINI_*` variable: do not add one. Verify with a production `expo export` and grep `dist/` for `generativelanguage.googleapis.com`.
- Prompt, response schema, request validation (including image magic bytes) and title tidying live in `supabase/functions/_shared/meal.ts` (pure, no Deno globals), shared by the Edge Function and the client proxy and unit tested. Edit it there only.
- Data: `repositories` (from `@/data`) is a facade over the active implementation. With Supabase configured it is a per-user local-first sync engine (`src/data/sync.ts`: instant cache reads, queued write-through to Supabase, last-write-wins pull); without it, the device-only store. Ids are UUIDs (`newId()`). Schema and RLS: `supabase/migrations/`; setup steps: `supabase/README.md`. Every new table needs RLS and a policy test.
- Auth: `src/auth/AuthProvider.tsx` + `Stack.Protected` in `src/app/_layout.tsx`. PKCE flow (`flowType: 'pkce'` in `src/lib/supabase.ts`): native deep links are handled by `exchangeCodeForSession(code)` and `parseAuthLink` deliberately ignores `access_token`/`refresh_token` in URLs (session injection). Session tokens are stored in `expo-secure-store` on native (chunked, `src/lib/secureStorage.ts`) and browser storage on web. Never put the service-role key or any secret in `EXPO_PUBLIC_*`.
- Meals store a small compressed JPEG thumbnail (data URI in `photoUri`), never the original photo.
- Reminders: `src/lib/reminders.ts` (native, expo-notifications) and `reminders.web.ts` (no-op, browsers can't schedule). Reminders are saved on every platform but only fire on iOS/Android.
- Never commit `.env.local`. `EXPO_PUBLIC_*` values are readable by anyone with the app.

## Cloud backend (Supabase)

- Tables: `profiles`, `meals`, `weight_logs`, `meal_reminders`, `ai_usage`, `ai_burst`; RLS on all, policies on `auth.uid()`; `ai_usage`, `ai_burst`, `consume_ai_scan()` and `refund_ai_scan()` are service-role only. Migrations: `supabase/migrations/`.
- Edge Function `analyze-meal`: verifies the JWT via `auth.getUser()`, caps the body at 8.5 MB (413), validates the image and its magic bytes (`_shared/meal.ts`), enforces `AI_DAILY_LIMIT` (default 60/user/day) and `AI_BURST_LIMIT` (default 6/user/minute) with 429s, fails closed if the quota check errors, calls Gemini with the server-side `GEMINI_API_KEY`, and refunds the daily scan if Gemini fails. Redeploy after edits: `npx supabase functions deploy analyze-meal`.
- Env: client gets only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_AI_BACKEND=proxy`. Secrets (`GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_LIMIT`, `AI_BURST_LIMIT`) are Supabase secrets. Full table in `README.md`.
- Supabase CLI 3.x defaults to the local stack: pass `--remote` to `db push` for the linked project. Never commit `supabase/.temp/` or env files.

## Commands

- `npx expo start` (press `w` for web in Chrome), `npm test`, `npm run typecheck`, `npx eslint src`
- Run typecheck, eslint and tests before calling work done.

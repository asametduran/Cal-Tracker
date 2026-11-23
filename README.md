# Cal Tracker

A Cal AI-style calorie tracker for iOS, Android and web. Snap a photo of a meal, an AI estimates the calories and macros, you adjust the numbers, and it lands in your daily totals. Built with Expo (SDK 58), React Native, TypeScript and Expo Router, with a Supabase backend.

## How it works

```
 Photo ──► analyzeMeal() ──► Supabase Edge Function `analyze-meal` ──► Gemini 2.5 Flash
                                   (verifies the user, rate-limits,          (key lives only
                                    validates the image)                      in server secrets)
 Review / adjust ──► repositories ──► local cache (instant) ──► sync queue ──► Supabase Postgres (RLS)
```

- **Screens:** Home (week strip, calorie ring, macro cards, recently logged, `+`), Progress (weight, streak, daily average, calendar), Settings (account, goals, reminders), plus Capture, Review, Meal, Weight, Onboarding and Sign-in.
- **Local-first sync:** reads come from a per-user on-device cache, so screens are instant and never flicker. Writes apply locally and go into a persisted queue that is pushed to Supabase in order and retried until it succeeds. Last write wins. Signing out syncs first and then wipes the cache.
- **Without Supabase** (no env vars) the app runs device-only: no accounts, data in SQLite (native) or localStorage (web), offline mock AI.

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored). Everything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by anyone who has it, so never put a secret there.

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | app (public) | Project URL, `https://<ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app (public) | Publishable/anon key. Safe to ship: Row Level Security protects the data |
| `EXPO_PUBLIC_AI_BACKEND` | app (public) | `proxy` \| `mock`. Unset = `proxy` if Supabase is configured, else `mock`. **Release builds always use `proxy`**. There is no client-side Gemini backend |
| `GEMINI_API_KEY` | Supabase secret | Gemini key used by the Edge Function. Never reaches the app |
| `GEMINI_MODEL` | Supabase secret | Optional, default `gemini-2.5-flash` |
| `AI_DAILY_LIMIT` | Supabase secret | Optional scans per user per day, default `60` |
| `AI_BURST_LIMIT` | Supabase secret | Optional scans per user per minute, default `6` |

## Database schema

`supabase/migrations/20261123000000_init.sql`. Every table has Row Level Security enabled and every policy is scoped to `auth.uid()`, so a signed-in user can only touch their own rows and anonymous requests can touch nothing.

| Table | Holds |
| --- | --- |
| `profiles` | one row per user: onboarding answers (goal, sex, age, height, weight, activity) and daily targets (calories, protein, carbs, fat) |
| `meals` | title, calories, macros, `day`, `logged_at`, and a small compressed JPEG thumbnail (data URI, at most 200 kB). Original photos are never stored |
| `weight_logs` | one weigh-in per row (`kg`, `day`, `logged_at`) |
| `meal_reminders` | reminder name, `hour`, `minute`, `enabled`, `sort_order` |
| `ai_usage` | per-user daily scan counter. No client access |
| `ai_burst` | per-user per-minute scan counter. No client access |

Only the service role can call `consume_ai_scan()` and `refund_ai_scan()` (migration `20261124000000_ai_burst_and_refund.sql`). A `security definer` trigger creates a profile and three default (disabled) reminders when a user signs up.

## Edge Function: `analyze-meal`

`supabase/functions/analyze-meal/index.ts`. `POST { image: <base64>, mimeType }` returns `{ title, calories, proteinG, carbsG, fatG }`.

1. Requires an `Authorization` header and verifies the JWT with `auth.getUser()` (`verify_jwt = true` as well). The anon key alone is rejected.
2. Rejects bodies over 8.5 MB (413), then validates the image: base64, at most 8M characters, and the first bytes must really be a JPEG (`/9j/`), PNG (`iVBOR`), WebP (`UklGR`) or HEIC/HEIF that matches the stated MIME type.
3. Enforces a per-user daily quota (default 60) and a per-minute burst limit (default 6): 429 `rate_limited`, with `Retry-After` for bursts. It fails closed if the check errors.
4. Calls Gemini with the server-side key and a structured-output schema, then returns a concise title (at most about 4 words) and macros. Non-food images return 422 `not_food`.
5. If the Gemini call fails or returns something unusable, the daily scan is refunded.

Errors are `{ code, message }`. The prompt, schema and validation live in `supabase/functions/_shared/meal.ts`, shared with the dev client and unit tested.

## Setup

```bash
npm install
cp .env.example .env.local          # then fill in the Supabase values
npx expo start                      # press w for web in Chrome
```

Backend (once per Supabase project, see `supabase/README.md` for details):

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push --remote
npx supabase secrets set GEMINI_API_KEY=<key>
npx supabase functions deploy analyze-meal
```

In the Supabase dashboard under Authentication, set the Site URL and add the redirect URLs `http://localhost:8081` and `caltracker://**` (plus your deployed web URL) so password-reset and confirmation links work.

## Commands

| Command | What it does |
| --- | --- |
| `npx expo start` | dev server (iOS, Android, web) |
| `npm test` | Jest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npx eslint src` | lint |

## Security notes

- **Auth uses PKCE.** Email links (confirm sign-up, reset password) carry a one-time `?code=` that Supabase only accepts from the device that requested the email, and the app exchanges it with `exchangeCodeForSession`. Session tokens in a URL are ignored, so a crafted link cannot sign someone into another account.
- **Session tokens** are stored in the iOS Keychain / Android Keystore (`expo-secure-store`, chunked because values are size-limited). On web they use standard browser storage.
- The Gemini key and service-role key exist only as Supabase secrets, and the app has no client-side Gemini code at all. A production web export contains neither a key nor the Gemini endpoint (verify with `npx expo export --platform web` and grep `dist/`).
- In the Supabase dashboard set the minimum password length to 8 (the server default is 6), and consider CAPTCHA for sign-up.
- `.env.local` and other env files are git-ignored. `.env.example` holds placeholders only.
- Known limits: the on-device cache uses AsyncStorage (about 6 MB on Android), calendar percentages use today's goals for past days, and reminders only fire on phones.

See `CLAUDE.md` for the architecture rules and `docs/stages.md` for build status.
